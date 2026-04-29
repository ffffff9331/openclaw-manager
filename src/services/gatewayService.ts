import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { canUseTauriInvoke, isWebPreview } from "../lib/platform";
import type {
  AppInstance,
  GatewayControlState,
  GatewayLaunchAgentHistoryItem,
  GatewayStatus,
} from "../types/core";
import { requestWithInstance } from "../lib/instanceTransport";
import { supportsHostServiceManagement, isLocalInstance } from "../lib/instanceCapabilities";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";

const GATEWAY_STATUS_JSON_COMMAND = "openclaw gateway status --json";
const GATEWAY_LOGS_COMMAND = "openclaw logs --limit 50";
const LOCAL_GATEWAY_LOG_LINES = 50;
const NO_INSTANCE_GATEWAY_MESSAGE = "请先选择要操作的实例，当前页不再默认回退到本机 local。";

function isWslInstance(instance?: AppInstance) {
  return instance?.type === "wsl";
}

function normalizeGatewayStatus(raw: any): GatewayStatus {
  if (!raw || typeof raw !== "object") {
    return { running: false };
  }

  const running =
    typeof raw.running === "boolean"
      ? raw.running
      : raw?.service?.runtime?.status === "running" || raw?.service?.runtime?.state === "active";

  const portCandidate =
    typeof raw.port === "number"
      ? raw.port
      : typeof raw?.gateway?.port === "number"
        ? raw.gateway.port
        : typeof raw?.port?.port === "number"
          ? raw.port.port
          : typeof raw?.gateway?.listen?.port === "number"
            ? raw.gateway.listen.port
            : undefined;

  const uptimeCandidate =
    typeof raw.uptime === "string"
      ? raw.uptime
      : typeof raw?.service?.runtime?.uptime === "string"
        ? raw.service.runtime.uptime
        : typeof raw?.runtime?.uptime === "string"
          ? raw.runtime.uptime
          : undefined;

  return {
    running: Boolean(running),
    port: typeof portCandidate === "number" ? portCandidate : undefined,
    uptime: typeof uptimeCandidate === "string" ? uptimeCandidate : undefined,
  };
}

export async function getGatewayStatus(instance?: AppInstance): Promise<GatewayStatus> {
  if (!instance) {
    return { running: false };
  }

  try {
    if (!canUseTauriInvoke() && isLocalInstance(instance)) {
      const response = await fetch("/__openclaw_gateway_status");
      if (response.ok) {
        return normalizeGatewayStatus(await response.json());
      }
    }

    const result = await requestWithInstance(instance, {
      path: instance.healthPath,
      command: GATEWAY_STATUS_JSON_COMMAND,
      accessMode: "read",
    });

    if (typeof result === "object" && result && "success" in result) {
      const commandResult = result as { success: boolean; output?: string };
      if (commandResult.success && commandResult.output?.trim()) {
        return normalizeGatewayStatus(JSON.parse(commandResult.output));
      }
    } else if (result) {
      return normalizeGatewayStatus(result);
    }
  } catch {
    // fallback below
  }

  if (!canUseTauriInvoke() || isWslInstance(instance)) {
    return { running: false };
  }

  return normalizeGatewayStatus(await invoke<GatewayStatus>("get_gateway_status"));
}

export async function fetchGatewayLogs(instance?: AppInstance) {
  if (!instance) {
    return NO_INSTANCE_GATEWAY_MESSAGE;
  }

  if (!isLocalInstance(instance) || isWslInstance(instance)) {
    const result = await readFromInstance(instance, GATEWAY_LOGS_COMMAND);
    return result.success ? result.output : result.error || "";
  }

  if (!canUseTauriInvoke()) {
    return "当前是 web preview；Gateway 日志读取仅在 Tauri 桌面环境可用。";
  }

  return invoke<string>("read_gateway_logs", { lines: LOCAL_GATEWAY_LOG_LINES });
}

export async function getGatewayControlState(instance?: AppInstance): Promise<GatewayControlState> {
  if (isWslInstance(instance)) {
    return {
      lastResult: "WSL2 实例的 Gateway 控制状态请以 WSL 内命令输出与实例状态为准；当前不走宿主机控制状态缓存。",
    };
  }

  if (!supportsHostServiceManagement(instance)) {
    return {
      lastResult: "当前实例不是本机；服务控制状态读取属于本机宿主能力，请改看该实例自身状态与部署侧日志。",
    };
  }

  if (!canUseTauriInvoke()) {
    return {
      lastResult: "当前是 web preview；Gateway 本机控制状态读取仅在 Tauri 桌面环境可用。",
    };
  }

  try {
    const raw = await invoke<string>("read_gateway_control_state");
    const parsed = JSON.parse(raw || "{}");
    return {
      lastDispatch: typeof parsed.lastDispatch === "string" ? parsed.lastDispatch : "",
      lastRequest: typeof parsed.lastRequest === "string" ? parsed.lastRequest : "",
      lastResult: typeof parsed.lastResult === "string" ? parsed.lastResult : "",
      lastLaunchAgentAction: typeof parsed.lastLaunchAgentAction === "string" ? parsed.lastLaunchAgentAction : "",
      lastLaunchAgentResult: typeof parsed.lastLaunchAgentResult === "string" ? parsed.lastLaunchAgentResult : "",
      lastLaunchAgentState: typeof parsed.lastLaunchAgentState === "string" ? parsed.lastLaunchAgentState : "",
      lastLaunchAgentStartedAt: typeof parsed.lastLaunchAgentStartedAt === "string" ? parsed.lastLaunchAgentStartedAt : "",
      lastLaunchAgentFinishedAt: typeof parsed.lastLaunchAgentFinishedAt === "string" ? parsed.lastLaunchAgentFinishedAt : "",
      lastLaunchAgentDurationSec: typeof parsed.lastLaunchAgentDurationSec === "number" ? parsed.lastLaunchAgentDurationSec : undefined,
      lastLaunchAgentLog: typeof parsed.lastLaunchAgentLog === "string" ? parsed.lastLaunchAgentLog : "",
      lastLaunchAgentError: typeof parsed.lastLaunchAgentError === "string" ? parsed.lastLaunchAgentError : "",
      lastLaunchAgentErrorKind: typeof parsed.lastLaunchAgentErrorKind === "string" ? parsed.lastLaunchAgentErrorKind : "",
      lastLaunchAgentRecoveryHint: typeof parsed.lastLaunchAgentRecoveryHint === "string" ? parsed.lastLaunchAgentRecoveryHint : "",
      launchAgentHistory: Array.isArray(parsed.launchAgentHistory)
        ? parsed.launchAgentHistory.filter((item: unknown): item is GatewayLaunchAgentHistoryItem => {
            if (!item || typeof item !== "object") return false;
            const candidate = item as Record<string, unknown>;
            return typeof candidate.at === "string" && typeof candidate.action === "string" && typeof candidate.state === "string";
          })
        : [],
      launchAgentPlistExists: Boolean(parsed.launchAgentPlistExists),
      launchAgentLoaded: Boolean(parsed.launchAgentLoaded),
      launchAgentStatus: typeof parsed.launchAgentStatus === "string" ? parsed.launchAgentStatus : "",
    };
  } catch {
    return {};
  }
}

export async function getGatewayDashboardUrl(instance?: AppInstance) {
  if (!instance) {
    throw new Error(NO_INSTANCE_GATEWAY_MESSAGE);
  }

  const result = await readFromInstance(instance, "openclaw gateway status");

  let url = instance.baseUrl;
  if (result.success) {
    const match = result.output.match(/Dashboard:\s*(https?:\/\/[^\s]+)/);
    if (match) {
      try {
        url = new URL(match[1]).toString();
      } catch {
        // regex 提取的 URL 格式异常，回退到 baseUrl
      }
    }
  }

  // 添加 token 参数
  if (instance.apiKey) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}token=${encodeURIComponent(instance.apiKey)}`;
  }

  return url;
}

export async function openGatewayDashboard(instance?: AppInstance) {
  const url = await getGatewayDashboardUrl(instance);

  if (canUseTauriInvoke()) {
    await openUrl(url);
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return url;
}

function unwrapGatewayCommandOutput(
  result: { success: boolean; output?: string; error?: string | null },
  action: "start" | "stop" | "restart",
) {
  if (!result.success) {
    throw new Error(result.error || result.output || `gateway ${action} failed`);
  }

  return result.output || `Gateway ${action} 请求已接受并入队`;
}

export async function controlGateway(action: "start" | "stop" | "restart", instance?: AppInstance): Promise<string> {
  if (!instance) {
    throw new Error(NO_INSTANCE_GATEWAY_MESSAGE);
  }

  const command = `openclaw gateway ${action}`;

  if (isLocalInstance(instance) && !isWslInstance(instance)) {
    if (!canUseTauriInvoke()) {
      return `当前是 web preview；Gateway ${action} 仅在 Tauri 桌面环境可用。`;
    }
    if (action === "restart") {
      return invoke<string>("dispatch_gateway_restart");
    }
    return invoke<string>("control_gateway", { action });
  }

  const result = await dispatchToInstance(instance, command);
  return unwrapGatewayCommandOutput(result, action);
}

export async function manageGatewayLaunchAgent(action: "install" | "load" | "unload" | "remove", instance?: AppInstance): Promise<string> {
  if (!instance) {
    throw new Error(NO_INSTANCE_GATEWAY_MESSAGE);
  }

  if (!supportsHostServiceManagement(instance)) {
    throw new Error("当前实例不是本机；服务管理属于本机宿主能力，请在对应机器或容器平台侧处理。");
  }

  if (!canUseTauriInvoke()) {
    return `当前是 web preview；LaunchAgent ${action} 仅在 Tauri 桌面环境可用。`;
  }

  return invoke<string>("manage_gateway_launch_agent", { action });
}

