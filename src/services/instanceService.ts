import { canUseTauriInvoke, readLocalCommand, readWslCommand } from "./commandService";
import { isWindows } from "../lib/platform";
import type { AppInstance, AppInstanceSource, AppInstanceStatus } from "../types/core";

function parseGatewayRunningFromJson(raw?: string): boolean {
  if (!raw?.trim()) return false;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.running === "boolean") return parsed.running;
    return parsed?.service?.runtime?.status === "running" || parsed?.service?.runtime?.state === "active";
  } catch {
    return false;
  }
}

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
    baseUrl: input.baseUrl || (normalizedType === "local" || normalizedType === "wsl" ? defaultLocalInstance.baseUrl : ""),
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

// ─── 多实例检测 ───

export interface DetectedInstance {
  type: AppInstance["type"];
  exists: boolean;
  running: boolean;
  baseUrl: string;
  version?: string;
  detail?: string;
  error?: string;
}

export interface InstanceDetectionResult {
  detected: DetectedInstance[];
  errors: string[];
}

/** 旧接口兼容 */
export interface LocalInstanceDetectionResult {
  exists: boolean;
  running: boolean;
  baseUrl: string;
  type?: AppInstance["type"];
  error?: string;
  detail?: string;
}

// ── 宿主本机探测 ──

async function detectHostLocal(): Promise<DetectedInstance | null> {
  if (!canUseTauriInvoke()) return null;
  try {
    const versionResult = await readLocalCommand("openclaw --version");
    if (!versionResult.success) return null;
    const statusResult = await readLocalCommand("openclaw gateway status --json");
    const running = statusResult.success && parseGatewayRunningFromJson(statusResult.output);
    return {
      type: "local",
      exists: true,
      running,
      baseUrl: DEFAULT_LOCAL_URL,
      version: versionResult.output.trim(),
      error: running ? undefined : "已检测到本机 OpenClaw，但 Gateway 当前未运行",
    };
  } catch {
    return null;
  }
}

// ── WSL2 探测（仅 Windows）──

async function detectWsl(): Promise<DetectedInstance | null> {
  if (!isWindows() || !canUseTauriInvoke()) return null;
  try {
    const versionResult = await readWslCommand("command -v openclaw >/dev/null 2>&1 && openclaw --version");
    if (!versionResult.success) return null;
    const statusResult = await readWslCommand("openclaw gateway status --json");
    const running = statusResult.success && parseGatewayRunningFromJson(statusResult.output);
    return {
      type: "wsl",
      exists: true,
      running,
      baseUrl: DEFAULT_LOCAL_URL,
      version: versionResult.output.trim(),
      error: running ? undefined : "已检测到 WSL2 OpenClaw，但 Gateway 当前未运行",
    };
  } catch {
    return null;
  }
}

// ── Docker 探测 ──

async function detectDocker(): Promise<DetectedInstance | null> {
  if (!canUseTauriInvoke()) return null;
  try {
    const filterCmd = isWindows()
      ? 'docker ps --filter "name=openclaw" --format "{{.Names}}" 2>nul'
      : 'docker ps --filter "name=openclaw" --format "{{.Names}}" 2>/dev/null';
    const findResult = await readLocalCommand(filterCmd);
    if (!findResult.success) return null;
    const containerName = findResult.output.trim().split("\n")[0]?.trim();
    if (!containerName) return null;

    const versionResult = await readLocalCommand(`docker exec ${containerName} openclaw --version`);
    const version = versionResult.success ? versionResult.output.trim() : undefined;

    const statusResult = await readLocalCommand(`docker exec ${containerName} openclaw gateway status --json`);
    const running = statusResult.success && parseGatewayRunningFromJson(statusResult.output);

    // 尝试获取容器映射端口
    const portResult = await readLocalCommand(`docker port ${containerName} 18789`);
    let baseUrl = DEFAULT_LOCAL_URL;
    if (portResult.success && portResult.output.trim()) {
      const portMatch = portResult.output.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      if (portMatch) {
        const host = portMatch[1] === "0.0.0.0" ? "127.0.0.1" : portMatch[1];
        baseUrl = `http://${host}:${portMatch[2]}/`;
      }
    }

    return {
      type: "docker",
      exists: true,
      running,
      baseUrl,
      version,
      detail: `容器: ${containerName}`,
      error: running ? undefined : `已检测到 Docker 容器 ${containerName}，但 Gateway 当前未运行`,
    };
  } catch {
    return null;
  }
}

// ── HTTP 端口探测（兜底）──

async function detectHttpReachable(): Promise<DetectedInstance | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    await fetch(DEFAULT_LOCAL_URL, {
      method: "GET",
      signal: controller.signal,
      mode: "no-cors",
    });
    clearTimeout(timeoutId);
    return {
      type: "local",
      exists: true,
      running: true,
      baseUrl: DEFAULT_LOCAL_URL,
      detail: "通过 HTTP 端口探测发现",
    };
  } catch {
    return null;
  }
}

/**
 * 全面检测当前机器上所有可能的 OpenClaw 安装方式。
 *
 * 检测顺序：WSL2（Windows）→ 宿主本机 → Docker → HTTP 端口兜底。
 * 返回所有检测到的实例，由调用方决定接入哪个。
 */
export async function detectInstances(): Promise<InstanceDetectionResult> {
  const detected: DetectedInstance[] = [];
  const errors: string[] = [];

  const [hostLocal, wsl, docker, httpReachable] = await Promise.allSettled([
    detectHostLocal(),
    detectWsl(),
    detectDocker(),
    detectHttpReachable(),
  ]);

  const extract = (settled: PromiseSettledResult<DetectedInstance | null>, label: string) => {
    if (settled.status === "fulfilled" && settled.value) {
      detected.push(settled.value);
    } else if (settled.status === "rejected") {
      errors.push(`${label} 探测失败: ${settled.reason}`);
    }
  };

  if (isWindows()) {
    extract(wsl, "WSL2");
    extract(hostLocal, "本机宿主");
  } else {
    extract(hostLocal, "本机宿主");
    extract(wsl, "WSL2");
  }
  extract(docker, "Docker");

  // 只有命令探测全空时才用 HTTP 兜底
  if (detected.length === 0) {
    extract(httpReachable, "HTTP 端口");
  }

  return { detected, errors };
}

/** 旧接口兼容：返回第一个检测到的实例 */
export async function detectLocalInstance(): Promise<LocalInstanceDetectionResult> {
  const { detected } = await detectInstances();
  if (detected.length === 0) {
    return { exists: false, running: false, baseUrl: DEFAULT_LOCAL_URL, error: "未检测到任何 OpenClaw 安装" };
  }
  const first = detected[0];
  return {
    exists: first.exists,
    running: first.running,
    baseUrl: first.baseUrl,
    type: first.type,
    detail: first.version || first.detail,
    error: first.error,
  };
}
