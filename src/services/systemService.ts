import { invoke } from "@tauri-apps/api/core";
import { isLocalInstance } from "../lib/instanceCapabilities";
import type { AppInstance } from "../types/core";
import { dispatchDetachedLocalCommand, readLocalCommand } from "./commandService";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";
import { isNewerVersion } from "./versionService";

export interface SystemInfo {
  appVersion: string;
  openclawVersion: string;
  nodeVersion: string;
  os: string;
  configPath: string;
  dataPath: string;
  updateAvailable: boolean;
  latestVersion: string;
  nodeUpdateAvailable: boolean;
  latestNodeVersion: string;
}

interface CommandResultLike {
  success: boolean;
  output: string;
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
}

interface VersionCheckSpec {
  url: string;
  extractVersion: (output: string) => string;
  errorLabel: string;
}

interface LoadedSystemState {
  systemInfo: SystemInfo;
  whitelistEnabled: boolean;
  fileAccessEnabled: boolean;
}

interface CachedLoadedSystemState {
  value: LoadedSystemState;
  at: number;
}

interface SystemSnapshot {
  appVersion: string;
  openclawVersion: string;
  nodeVersion: string;
  os: string;
  configPath: string;
  dataPath: string;
  whitelistEnabled: boolean;
  fileAccessEnabled: boolean;
}

const EMPTY_UPDATE_RESULT: UpdateCheckResult = {
  updateAvailable: false,
  latestVersion: "",
};
const NO_INSTANCE_SYSTEM_MESSAGE = "请先选择要操作的实例，系统页不再默认回退到本机 local。";

const SYSTEM_INFO_CACHE_TTL_MS = 30_000;
const systemInfoCache = new Map<string, CachedLoadedSystemState>();

const SYSTEM_INFO_FIELDS = ["appVersion", "openclawVersion", "nodeVersion", "os", "configPath", "dataPath"] as const;

const SYSTEM_SNAPSHOT_COMMANDS = {
  openclawVersion: "openclaw --version",
  nodeVersion: "node --version",
  groupPolicy: "openclaw config get channels.telegram.groupPolicy",
  fileAccess: "openclaw config get agents.defaults.sandbox.fs",
} as const;

const BOOLEAN_POLICY_SPECS = {
  whitelist: {
    path: "channels.telegram.groupPolicy",
    values: { enabled: "allowlist", disabled: "open" },
  },
  fileAccess: {
    path: "agents.defaults.sandbox.fs",
    values: { enabled: "all", disabled: "none" },
  },
} as const;

type BooleanPolicySpec = (typeof BOOLEAN_POLICY_SPECS)[keyof typeof BOOLEAN_POLICY_SPECS];

const OS_DETECTION_SPECS = [
  { command: "sw_vers -productVersion", format: (output: string) => `macOS ${output.trim()}` },
  { command: "ver", format: (output: string) => `Windows ${output.trim()}` },
] as const;

const VERSION_CHECK_SPECS = {
  openclaw: {
    url: "https://api.github.com/repos/openclaw/openclaw/releases/latest",
    errorLabel: "OpenClaw",
    extractVersion: (output: string) => {
      const match = output.match(/"tag_name":\s*"([^"]+)"/);
      return match?.[1]?.replace("v", "").split("-")[0] ?? "";
    },
  },
  node: {
    url: "https://nodejs.org/dist/index.json",
    errorLabel: "Node.js",
    extractVersion: (output: string) => {
      const match = output.match(/"lts":\s*"([^"]+)"[^}]*"version":\s*"v([^"]+)"/);
      return match?.[2] ?? "";
    },
  },
} satisfies Record<string, VersionCheckSpec>;

function canUseTauriInvoke() {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof invoke === "function" && typeof tauriInternals?.invoke === "function";
}

async function runReadCommand(instance: AppInstance | undefined, command: string) {
  return readFromInstance(instance, command);
}

async function dispatchCommand(instance: AppInstance | undefined, command: string) {
  return dispatchToInstance(instance, command);
}

async function loadLogs(lines: number, instance?: AppInstance) {
  if (!instance) {
    return NO_INSTANCE_SYSTEM_MESSAGE;
  }

  if (!isLocalInstance(instance)) {
    const result = await runReadCommand(instance, `openclaw logs --limit ${lines}`);
    return result.success ? result.output : result.error || "";
  }

  if (!canUseTauriInvoke()) {
    return "当前是 web preview；App 日志读取仅在 Tauri 桌面环境可用。";
  }

  return invoke<string>("read_app_logs", { lines });
}

async function loadDoctorResult(lines: number, instance?: AppInstance) {
  if (!instance) {
    return NO_INSTANCE_SYSTEM_MESSAGE;
  }

  if (!isLocalInstance(instance)) {
    const result = await runReadCommand(instance, `openclaw logs --limit ${lines}`);
    return result.success ? result.output : result.error || "";
  }

  if (!canUseTauriInvoke()) {
    return "当前是 web preview；诊断结果读取仅在 Tauri 桌面环境可用。";
  }

  return invoke<string>("read_doctor_result", { lines });
}

async function updateBooleanPolicy(spec: BooleanPolicySpec, enabled: boolean, instance?: AppInstance) {
  const value = enabled ? spec.values.enabled : spec.values.disabled;
  await dispatchCommand(instance, `openclaw config set ${spec.path} \"${value}\"`);
}

function getTrimmedOutput(result: CommandResultLike, fallback = "") {
  return result.success ? result.output.trim() : fallback;
}

function detectOpenClawPath(kind: "config" | "data", instance?: AppInstance) {
  if (!isLocalInstance(instance) && instance) {
    return `${instance.type.toUpperCase()} 实例（${kind === "config" ? "配置" : "数据"}路径待查询）`;
  }
  return "~/.openclaw/";
}

function buildOpenClawPaths(instance?: AppInstance) {
  return {
    configPath: detectOpenClawPath("config", instance),
    dataPath: detectOpenClawPath("data", instance),
  };
}

async function detectOsInfo(instance?: AppInstance) {
  for (const spec of OS_DETECTION_SPECS) {
    try {
      const result = await runReadCommand(instance, spec.command);
      if (result.success) {
        return spec.format(result.output);
      }
    } catch {
      // ignore
    }
  }

  return "Unknown";
}

async function checkVersionUpdate(currentVersion: string, spec: VersionCheckSpec, instance?: AppInstance): Promise<UpdateCheckResult> {
  try {
    const latestResult = await runReadCommand(instance, `curl --connect-timeout 2 --max-time 4 -fsSL \"${spec.url}\"`);
    if (!latestResult.success) return EMPTY_UPDATE_RESULT;
    const latestVersion = spec.extractVersion(latestResult.output);
    return {
      updateAvailable: Boolean(currentVersion && latestVersion) && isNewerVersion(currentVersion, latestVersion),
      latestVersion: latestVersion ? `v${latestVersion}` : "",
    };
  } catch (e) {
    console.error(`Failed to check ${spec.errorLabel} update:`, e);
    return EMPTY_UPDATE_RESULT;
  }
}

async function checkOpenClawUpdate(currentVersion: string, instance?: AppInstance): Promise<UpdateCheckResult> {
  return checkVersionUpdate(currentVersion, VERSION_CHECK_SPECS.openclaw, instance);
}

async function checkNodeUpdate(currentNodeVersion: string, instance?: AppInstance): Promise<UpdateCheckResult> {
  return checkVersionUpdate(currentNodeVersion, VERSION_CHECK_SPECS.node, instance);
}

function matchesConfigValue(output: string, expectedValue: string) {
  return output.includes(`\"${expectedValue}\"`) || output.includes(expectedValue);
}

function isBooleanPolicyEnabled(output: string, spec: BooleanPolicySpec) {
  return matchesConfigValue(output, spec.values.enabled);
}

function isWhitelistEnabled(output: string) {
  return isBooleanPolicyEnabled(output, BOOLEAN_POLICY_SPECS.whitelist);
}

function isFileAccessEnabled(output: string) {
  return isBooleanPolicyEnabled(output, BOOLEAN_POLICY_SPECS.fileAccess);
}

function buildSystemSnapshot(
  instance: AppInstance | undefined,
  results: {
    versionResult: CommandResultLike;
    nodeResult: CommandResultLike;
    groupPolicyResult: CommandResultLike;
    fileAccessResult: CommandResultLike;
    osInfo: string;
  },
): Omit<SystemSnapshot, "appVersion"> {
  const paths = buildOpenClawPaths(instance);

  return {
    openclawVersion: getTrimmedOutput(results.versionResult, "未知"),
    nodeVersion: getTrimmedOutput(results.nodeResult, "未知"),
    os: results.osInfo,
    configPath: paths.configPath,
    dataPath: paths.dataPath,
    whitelistEnabled: isWhitelistEnabled(results.groupPolicyResult.output),
    fileAccessEnabled: isFileAccessEnabled(results.fileAccessResult.output),
  };
}

export async function readManagerAppVersion() {
  if (canUseTauriInvoke()) {
    try {
      return await invoke<string>("get_app_version");
    } catch {
      // ignore
    }
  }

  try {
    const result = await readLocalCommand("node -p \"require('./package.json').version\"");
    return result.success ? result.output.trim() : "";
  } catch {
    return "";
  }
}

async function readSystemSnapshot(instance?: AppInstance): Promise<SystemSnapshot> {
  const [appVersion, versionResult, nodeResult, groupPolicyResult, fileAccessResult, osInfo] = await Promise.all([
    readManagerAppVersion(),
    runReadCommand(instance, SYSTEM_SNAPSHOT_COMMANDS.openclawVersion),
    runReadCommand(instance, SYSTEM_SNAPSHOT_COMMANDS.nodeVersion),
    runReadCommand(instance, SYSTEM_SNAPSHOT_COMMANDS.groupPolicy),
    runReadCommand(instance, SYSTEM_SNAPSHOT_COMMANDS.fileAccess),
    detectOsInfo(instance),
  ]);

  return {
    appVersion: appVersion || "未知",
    ...buildSystemSnapshot(instance, {
      versionResult,
      nodeResult,
      groupPolicyResult,
      fileAccessResult,
      osInfo,
    }),
  };
}

function getCurrentVersions(snapshot: SystemSnapshot) {
  return {
    openclawVersion: snapshot.openclawVersion.replace("OpenClaw ", "").split(" ")[0],
    nodeVersion: snapshot.nodeVersion.replace("v", ""),
  };
}

async function resolveVersionUpdates(snapshot: SystemSnapshot, instance?: AppInstance) {
  const currentVersions = getCurrentVersions(snapshot);
  const [openclawUpdate, nodeUpdate] = await Promise.all([
    checkOpenClawUpdate(currentVersions.openclawVersion, instance),
    checkNodeUpdate(currentVersions.nodeVersion, instance),
  ]);
  return { openclawUpdate, nodeUpdate };
}

function buildSystemInfo(snapshot: SystemSnapshot, updates: { openclawUpdate: UpdateCheckResult; nodeUpdate: UpdateCheckResult }): SystemInfo {
  const baseInfo = Object.fromEntries(SYSTEM_INFO_FIELDS.map((field) => [field, snapshot[field]])) as Pick<SystemInfo, (typeof SYSTEM_INFO_FIELDS)[number]>;
  return {
    ...baseInfo,
    updateAvailable: updates.openclawUpdate.updateAvailable,
    latestVersion: updates.openclawUpdate.latestVersion,
    nodeUpdateAvailable: updates.nodeUpdate.updateAvailable,
    latestNodeVersion: updates.nodeUpdate.latestVersion,
  };
}

function getSystemInfoCacheKey(instance?: AppInstance, shouldCheckUpdates?: boolean) {
  const instanceKey = instance ? `${instance.type}:${instance.id}:${instance.baseUrl}` : "no-instance";
  return `${instanceKey}:updates:${shouldCheckUpdates ? "on" : "off"}`;
}

export async function loadSystemInfo(
  instance?: AppInstance,
  options: { checkUpdates?: boolean } = {},
): Promise<LoadedSystemState> {
  const shouldCheckUpdates = options.checkUpdates ?? true;
  const cacheKey = getSystemInfoCacheKey(instance, shouldCheckUpdates);
  const cached = systemInfoCache.get(cacheKey);

  if (cached && Date.now() - cached.at < SYSTEM_INFO_CACHE_TTL_MS) {
    return cached.value;
  }

  const snapshot = await readSystemSnapshot(instance);
  const { openclawUpdate, nodeUpdate } = shouldCheckUpdates
    ? await resolveVersionUpdates(snapshot, instance)
    : { openclawUpdate: EMPTY_UPDATE_RESULT, nodeUpdate: EMPTY_UPDATE_RESULT };

  const loaded = {
    systemInfo: buildSystemInfo(snapshot, { openclawUpdate, nodeUpdate }),
    whitelistEnabled: snapshot.whitelistEnabled,
    fileAccessEnabled: snapshot.fileAccessEnabled,
  };

  systemInfoCache.set(cacheKey, { value: loaded, at: Date.now() });
  return loaded;
}

export async function runDoctorCommand(instance?: AppInstance) {
  if (!instance) {
    throw new Error(NO_INSTANCE_SYSTEM_MESSAGE);
  }

  if (instance.type === "local") {
    const result = await dispatchDetachedLocalCommand("openclaw doctor >/tmp/openclaw-manager-doctor.log 2>&1");
    if (!result.success) {
      throw new Error(result.error || result.output || "诊断投递失败");
    }
    return "诊断任务已投递；可用“刷新诊断结果”查看最近输出。";
  }

  if (instance.type === "wsl") {
    const result = await dispatchCommand(instance, "openclaw doctor >/tmp/openclaw-manager-doctor.log 2>&1");
    if (!result.success) {
      throw new Error(result.error || result.output || "诊断投递失败");
    }
    return "WSL2 诊断任务已投递；可用“刷新诊断结果”查看最近输出。";
  }

  const result = await dispatchCommand(instance, "openclaw doctor");
  if (!result.success) {
    throw new Error(result.error || result.output || "诊断投递失败");
  }
  return result.output || "远端诊断命令已投递";
}

export async function readLatestDoctorResult(instance?: AppInstance) {
  return loadDoctorResult(200, instance);
}

export async function loadAppLogs(instance?: AppInstance) {
  return loadLogs(100, instance);
}

export async function toggleWhitelist(enabled: boolean, instance?: AppInstance) {
  return updateBooleanPolicy(BOOLEAN_POLICY_SPECS.whitelist, enabled, instance);
}

export async function updateWhitelistPolicy(enabled: boolean, instance?: AppInstance) {
  return toggleWhitelist(enabled, instance);
}

export async function toggleFileAccess(enabled: boolean, instance?: AppInstance) {
  return updateBooleanPolicy(BOOLEAN_POLICY_SPECS.fileAccess, enabled, instance);
}

export async function updateFileAccessPolicy(enabled: boolean, instance?: AppInstance) {
  return toggleFileAccess(enabled, instance);
}
