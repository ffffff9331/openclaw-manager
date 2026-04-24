import type { AppInstance, CommandResult, ModelConfig, ModelFormState } from "../types/core";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";

interface ModelsConfigPayload {
  providers?: Record<string, any>;
}

export interface CurrentModelInfo {
  model: string;
  provider: string;
}

interface CachedModelConfigsEntry {
  value: ModelConfig[];
  at: number;
}

interface CachedCurrentModelEntry {
  value: CurrentModelInfo;
  at: number;
}

const MODEL_READ_CACHE_TTL_MS = 30_000;
const modelConfigsCache = new Map<string, CachedModelConfigsEntry>();
const currentModelCache = new Map<string, CachedCurrentModelEntry>();

export interface ModelConnectivityResult {
  ok: boolean;
  message: string;
  status?: number;
}

function getModelCacheKey(instance?: AppInstance) {
  return instance ? `${instance.type}:${instance.id}:${instance.baseUrl}` : "local:default";
}

function isWebPreview() {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof tauriInternals?.invoke !== "function";
}

function getModelProviderPath(provider: string, key?: string) {
  const basePath = `models.providers.${provider}`;
  return key ? `${basePath}.${key}` : basePath;
}

function parseOpenClawJson(output: string): any {
  if (!output) return {};
  const cleanOutput = output.replace(/^\[plugins\].*$/gm, "").trim();
  try {
    return JSON.parse(cleanOutput || "{}");
  } catch (e) {
    console.error("JSON parse error:", e, "raw output:", output);
    return {};
  }
}

function parseCurrentModelKey(value: string): CurrentModelInfo {
  if (value.includes("/")) {
    const [provider, ...rest] = value.split("/");
    return { model: rest.join("/"), provider };
  }
  return { model: value, provider: "" };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function parseNumberField(value: string, fieldName: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} 必须是大于 0 的数字`);
  }
  return parsed;
}

function buildProviderConfig(form: ModelFormState) {
  return {
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    api: "openai-completions",
    models: [
      {
        id: form.id.trim(),
        name: form.name.trim(),
        contextWindow: parseNumberField(form.contextWindow, "上下文窗口") ?? 128000,
        maxTokens: parseNumberField(form.maxTokens, "最大输出") ?? 8192,
      },
    ],
  };
}

async function readModelCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  return readFromInstance(instance, command);
}

async function dispatchModelCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  return dispatchToInstance(instance, command);
}

async function getParsedModelsConfig(instance?: AppInstance): Promise<ModelsConfigPayload> {
  const result = await getRawModelsConfig(instance);
  if (!result.success || !result.output) return {};
  return parseOpenClawJson(result.output) as ModelsConfigPayload;
}

export async function getRawModelsConfig(instance?: AppInstance) {
  if ((!instance || instance.type === "local" || instance.type === "wsl") && isWebPreview()) {
    const response = await fetch("/__openclaw_models");
    return { success: response.ok, output: await response.text(), error: null } as CommandResult;
  }
  return readModelCommand(instance, "openclaw config get models");
}

export async function loadModelConfigs(instance?: AppInstance): Promise<ModelConfig[]> {
  const cacheKey = getModelCacheKey(instance);
  const cached = modelConfigsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MODEL_READ_CACHE_TTL_MS) {
    return cached.value;
  }

  const config = await getParsedModelsConfig(instance);
  const configs: ModelConfig[] = [];
  if (config.providers) {
    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      const pc = providerConfig as any;
      if (pc.models) {
        for (const model of pc.models) {
          configs.push({
            provider: providerName,
            name: model.name || model.id,
            id: model.id,
            baseUrl: pc.baseUrl || "",
            apiKey: pc.apiKey ? "***已配置***" : "",
            apiKeyRaw: pc.apiKey || "",
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
          });
        }
      }
    }
  }

  modelConfigsCache.set(cacheKey, { value: configs, at: Date.now() });
  return configs;
}

export async function loadCurrentModel(instance?: AppInstance): Promise<CurrentModelInfo> {
  const cacheKey = getModelCacheKey(instance);
  const cached = currentModelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MODEL_READ_CACHE_TTL_MS) {
    return cached.value;
  }

  let result: CommandResult;
  if ((!instance || instance.type === "local" || instance.type === "wsl") && isWebPreview()) {
    const response = await fetch("/__openclaw_current_model");
    result = { success: response.ok, output: await response.text(), error: null };
  } else {
    result = await readModelCommand(instance, "openclaw config get agents.defaults.model");
  }
  if (!result.success || !result.output) {
    const empty = { model: "", provider: "" };
    currentModelCache.set(cacheKey, { value: empty, at: Date.now() });
    return empty;
  }
  const raw = result.output.trim();
  const parsed = (() => {
    try {
      const json = JSON.parse(raw);
      const primary = typeof json?.primary === "string" ? json.primary : "";
      return parseCurrentModelKey(primary);
    } catch {
      return parseCurrentModelKey(raw);
    }
  })();

  currentModelCache.set(cacheKey, { value: parsed, at: Date.now() });
  return parsed;
}

export async function addModelConfig(newModelConfig: ModelFormState, instance?: AppInstance) {
  if (!newModelConfig.name || !newModelConfig.id || !newModelConfig.baseUrl) return;
  const providerConfig = buildProviderConfig(newModelConfig);
  const providerName = `custom-${Date.now()}`;
  await dispatchModelCommand(instance, `openclaw config set ${getModelProviderPath(providerName)} ${shellQuote(JSON.stringify(providerConfig))}`);
}

export function buildEditModelForm(model: ModelConfig): ModelFormState {
  return {
    name: model.name,
    id: model.id,
    baseUrl: model.baseUrl,
    apiKey: model.apiKeyRaw || "",
    contextWindow: model.contextWindow ? String(model.contextWindow) : "",
    maxTokens: model.maxTokens ? String(model.maxTokens) : "",
  };
}

export function validateModelForm(form: ModelFormState) {
  if (!form.name.trim()) throw new Error("模型名称不能为空");
  if (!form.id.trim()) throw new Error("模型 ID 不能为空");
  if (!form.baseUrl.trim()) throw new Error("Base URL 不能为空");
  parseNumberField(form.contextWindow, "上下文窗口");
  parseNumberField(form.maxTokens, "最大输出");
}

export async function saveModelEdit(editingModel: ModelConfig, form: ModelFormState, instance?: AppInstance) {
  validateModelForm(form);
  const provider = editingModel.provider;
  const providerConfig = buildProviderConfig(form);
  if (!providerConfig.apiKey) {
    delete (providerConfig as { apiKey?: string }).apiKey;
  }
  await dispatchModelCommand(instance, `openclaw config set ${getModelProviderPath(provider)} ${shellQuote(JSON.stringify(providerConfig))}`);
}

export async function setDefaultModel(modelId: string, provider: string, instance?: AppInstance) {
  const modelKey = `${provider}/${modelId}`;
  await dispatchModelCommand(instance, `openclaw config set agents.defaults.model ${shellQuote(modelKey)}`);
  await dispatchModelCommand(instance, `openclaw config set agents.defaults.models.${modelKey.replace(/\//g, "\\/")}.alias ${shellQuote(modelId)}`);
}

export function canDeleteModelProvider(provider: string) {
  return provider.startsWith("custom-") && provider !== "custom-api-edgefn-backup";
}

export async function deleteModel(provider: string, modelId: string, instance?: AppInstance) {
  const config = await getParsedModelsConfig(instance);
  const providerConfig = config.providers?.[provider];
  const models = Array.isArray(providerConfig?.models) ? [...providerConfig.models] : [];
  const nextModels = models.filter((item: any) => item?.id !== modelId);
  if (nextModels.length === models.length) {
    throw new Error(`未找到模型 ${modelId}`);
  }

  if (nextModels.length === 0) {
    await dispatchModelCommand(instance, `openclaw config unset ${getModelProviderPath(provider)}`);
    return;
  }

  const nextProviderConfig = { ...providerConfig, models: nextModels };
  await dispatchModelCommand(instance, `openclaw config set ${getModelProviderPath(provider)} ${shellQuote(JSON.stringify(nextProviderConfig))}`);
}

export async function moveModel(provider: string, modelId: string, direction: "up" | "down", instance?: AppInstance) {
  const config = await getParsedModelsConfig(instance);
  const providerConfig = config.providers?.[provider];
  const models = Array.isArray(providerConfig?.models) ? [...providerConfig.models] : [];
  const index = models.findIndex((item: any) => item?.id === modelId);
  if (index < 0) throw new Error(`未找到模型 ${modelId}`);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= models.length) return;
  const next = [...models];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  const nextProviderConfig = { ...providerConfig, models: next };
  await dispatchModelCommand(instance, `openclaw config set ${getModelProviderPath(provider)} ${shellQuote(JSON.stringify(nextProviderConfig))}`);
}

function buildConnectivityCandidateUrls(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed) return [];
  return Array.from(new Set([trimmed, `${trimmed}/models`, `${trimmed}/chat/completions`]));
}

function buildConnectivityHeaders(model: ModelConfig) {
  const headers: Record<string, string> = { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" };
  const apiKey = model.apiKeyRaw?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

export async function testModelConnectivity(model: ModelConfig): Promise<ModelConnectivityResult> {
  const urls = buildConnectivityCandidateUrls(model.baseUrl);
  if (!urls.length) return { ok: false, message: "缺少 Base URL" };
  const headers = buildConnectivityHeaders(model);
  let lastError = "";
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "GET", headers });
      if (response.ok) return { ok: true, status: response.status, message: `连通成功：${new URL(url).pathname || "/"}（HTTP ${response.status}）` };
      if ([200, 204, 401, 403, 404, 405].includes(response.status)) {
        return { ok: true, status: response.status, message: `目标可达：${new URL(url).pathname || "/"}（HTTP ${response.status}）` };
      }
      lastError = `HTTP ${response.status} @ ${url}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { ok: false, message: lastError || "连通测试失败" };
}
