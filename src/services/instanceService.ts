import { readWslCommand } from "./commandService";
import type { AppInstance, AppInstanceSource, AppInstanceStatus } from "../types/core";

const STORAGE_KEY = "ocm.instances.v2";
const CURRENT_KEY = "ocm.currentInstance.v2";
const SETTINGS_KEY = "ocm.settings.v2";

export interface PersistedSettings {
  mdnsEnabled: boolean;
  allowLanAccess: boolean;
}

const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  mdnsEnabled: false,
  allowLanAccess: true,
};

const now = () => new Date().toISOString();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function validateInstanceBaseUrl(
  baseUrl: string,
  options?: { allowLanAccess?: boolean },
): { valid: boolean; reason?: string; warning?: string } {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: "实例地址不能为空" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, reason: "实例地址格式不合法，请填写完整的 http/https 地址" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { valid: false, reason: "只允许 http 或 https 协议" };
  }

  if (!url.hostname) {
    return { valid: false, reason: "实例地址缺少主机名" };
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalHost = LOCAL_HOSTS.has(hostname);
  const isLanHost = hostname.endsWith(".local") || isPrivateIpv4(hostname);
  const allowLanAccess = options?.allowLanAccess ?? true;
  const allowed = isLocalHost || (allowLanAccess && isLanHost);

  if (!allowed) {
    return {
      valid: false,
      reason: allowLanAccess
        ? "当前仅允许 localhost、127.0.0.1、局域网私有网段地址或 .local 主机名"
        : "当前已关闭局域网访问，只允许 localhost 或 127.0.0.1",
    };
  }

  const warning = isLocalHost
    ? undefined
    : "将允许应用访问局域网实例，请确认该地址可信且在你的内网范围内。";

  return { valid: true, warning };
}

const defaultLocalInstance: AppInstance = {
  id: "local-default",
  name: "本机 OpenClaw",
  type: "local",
  baseUrl: "http://127.0.0.1:18789/",
  status: "unknown",
  isCurrent: true,
  source: "manual",
  notes: "默认本地实例",
  apiBasePath: "/",
  healthPath: "/health",
  createdAt: now(),
  updatedAt: now(),
};

const DEFAULT_INSTANCES = [defaultLocalInstance];

function normalizeInstanceRecord(input: Partial<AppInstance> | null | undefined): AppInstance | null {
  if (!input?.id || !input.name) {
    return null;
  }

  const normalizedType = input.type === "local" || input.type === "wsl" || input.type === "docker" || input.type === "nas" || input.type === "remote"
    ? input.type
    : "remote";

  return {
    id: input.id,
    name: input.name,
    type: normalizedType,
    baseUrl: input.baseUrl || (normalizedType === "local" ? defaultLocalInstance.baseUrl : ""),
    status: input.status || "unknown",
    apiKey: input.apiKey || "",
    isCurrent: Boolean(input.isCurrent),
    source: input.source || "manual",
    notes: input.notes || "",
    apiBasePath: input.apiBasePath || "/",
    healthPath: input.healthPath || "/health",
    createdAt: input.createdAt || now(),
    updatedAt: input.updatedAt || input.createdAt || now(),
  };
}

export function loadInstances(): AppInstance[] {
  if (typeof window === "undefined") return DEFAULT_INSTANCES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Array<Partial<AppInstance>>) : [];
    const normalized = saved
      .map(normalizeInstanceRecord)
      .filter((item): item is AppInstance => Boolean(item));
    const merged = normalized.length > 0 ? normalized : DEFAULT_INSTANCES;
    const storedCurrentId = localStorage.getItem(CURRENT_KEY) || defaultLocalInstance.id;
    const resolvedCurrentId = merged.some((item) => item.id === storedCurrentId)
      ? storedCurrentId
      : merged[0]?.id || defaultLocalInstance.id;

    if (resolvedCurrentId !== storedCurrentId) {
      localStorage.setItem(CURRENT_KEY, resolvedCurrentId);
    }

    const nextInstances = merged.map((item) => ({
      ...item,
      isCurrent: item.id === resolvedCurrentId,
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextInstances));
    return nextInstances;
  } catch {
    return DEFAULT_INSTANCES;
  }
}

export function saveInstances(instances: AppInstance[]) {
  if (typeof window === "undefined") return;

  const normalized = instances
    .map(normalizeInstanceRecord)
    .filter((item): item is AppInstance => Boolean(item));
  const resolvedCurrentId = normalized.find((item) => item.isCurrent)?.id || normalized[0]?.id || defaultLocalInstance.id;
  const nextInstances = (normalized.length > 0 ? normalized : DEFAULT_INSTANCES).map((item) => ({
    ...item,
    isCurrent: item.id === resolvedCurrentId,
  }));

  localStorage.setItem(CURRENT_KEY, resolvedCurrentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextInstances));
}

export function setCurrentInstance(instanceId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENT_KEY, instanceId);
}

export function loadSettings(): PersistedSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PERSISTED_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? (JSON.parse(raw) as PersistedSettings)
      : DEFAULT_PERSISTED_SETTINGS;
  } catch {
    return DEFAULT_PERSISTED_SETTINGS;
  }
}

export function saveSettings(settings: PersistedSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface CreateInstanceInput {
  id?: string;
  name: string;
  type: AppInstance["type"];
  baseUrl: string;
  apiBasePath?: string;
  healthPath?: string;
  apiKey?: string;
  status?: AppInstanceStatus;
  source?: AppInstanceSource;
  notes?: string;
  createdAt?: string;
}

export function createManualInstance(input: CreateInstanceInput): AppInstance {
  return {
    id: input.id || `instance-${Date.now()}`,
    name: input.name,
    type: input.type,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey || "",
    status: input.status || "unknown",
    isCurrent: false,
    source: input.source || "manual",
    notes: input.notes || "",
    apiBasePath: input.apiBasePath || "/",
    healthPath: input.healthPath || "/health",
    createdAt: input.createdAt || now(),
    updatedAt: now(),
  };
}

const DEFAULT_LOCAL_URL = "http://127.0.0.1:18789/";

export interface LocalInstanceDetectionResult {
  exists: boolean;
  running: boolean;
  baseUrl: string;
  type?: AppInstance["type"];
  error?: string;
  detail?: string;
}

export async function detectLocalInstance(): Promise<LocalInstanceDetectionResult> {
  const baseUrl = DEFAULT_LOCAL_URL;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(baseUrl, {
      method: "GET",
      signal: controller.signal,
      mode: "no-cors",
    });
    clearTimeout(timeoutId);

    // no-cors returns opaque response, which we treat as "might be running"
    // If we got here without error, the port is reachable
    return { exists: true, running: true, baseUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const wslVersion = await readWslCommand("command -v openclaw >/dev/null 2>&1 && openclaw --version");
    if (wslVersion.success) {
      const wslStatus = await readWslCommand("openclaw gateway status --json");
      return {
        exists: true,
        running: wslStatus.success,
        baseUrl,
        type: "wsl",
        detail: wslVersion.output.trim(),
        error: wslStatus.success ? undefined : wslStatus.error || wslStatus.output || "已检测到 WSL2 OpenClaw，但 Gateway 未运行或状态不可读",
      };
    }

    const wslError = wslVersion.error || wslVersion.output;
    // Timeout or network error means not reachable
    if (errorMsg.includes("abort") || errorMsg.includes("Failed to fetch")) {
      return { exists: false, running: false, baseUrl, error: `无法连接到本机实例；WSL2 也未检测到 OpenClaw${wslError ? `：${wslError}` : ""}` };
    }
    return { exists: false, running: false, baseUrl, error: wslError ? `${errorMsg}；WSL2：${wslError}` : errorMsg };
  }
}
