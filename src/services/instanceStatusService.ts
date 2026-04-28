import type { AppInstance, AppInstanceStatus } from "../types/core";
import { readFromInstance } from "./instanceCommandService";

function parseGatewayRunningFromJson(raw?: string): boolean {
  if (!raw?.trim()) return false;
  try {
    // 移除装饰字符和警告，找到 JSON 开始
    const lines = raw.split('\n');
    const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
    if (jsonStart === -1) return false;
    const jsonLines = lines.slice(jsonStart);
    const cleanOutput = jsonLines.join('\n').trim();
    const parsed = JSON.parse(cleanOutput);
    if (typeof parsed?.running === "boolean") return parsed.running;
    return parsed?.service?.runtime?.status === "running" || parsed?.service?.runtime?.state === "active";
  } catch {
    return false;
  }
}

function canUseTauriInvoke() {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof tauriInternals?.invoke === "function";
}

function isWebPreview() {
  return typeof window !== "undefined" && !canUseTauriInvoke();
}

async function probeViaHttpHealth(instance: AppInstance): Promise<AppInstanceStatus> {
  const healthUrl = isWebPreview() && (instance.type === "local" || instance.type === "wsl")
    ? "/__openclaw_health"
    : new URL(instance.healthPath || "/health", instance.baseUrl).toString();

  try {
    const response = await fetch(healthUrl, { method: "GET" });
    return response.ok ? "online" : "offline";
  } catch {
    return isWebPreview() && (instance.type === "local" || instance.type === "wsl") ? "unknown" : "offline";
  }
}

async function probeLocalInstance(instance: AppInstance): Promise<AppInstanceStatus> {
  if (!canUseTauriInvoke()) {
    return probeViaHttpHealth(instance);
  }

  try {
    const result = await readFromInstance(instance, "openclaw gateway status --json");
    if (result.success && parseGatewayRunningFromJson(result.output)) {
      return "online";
    }
    return probeViaHttpHealth(instance);
  } catch {
    return probeViaHttpHealth(instance);
  }
}

export async function probeInstanceStatus(instance: AppInstance): Promise<AppInstanceStatus> {
  if (instance.type === "local" || instance.type === "wsl") {
    return probeLocalInstance(instance);
  }

  try {
    const result = await readFromInstance(instance, "openclaw gateway status --json");
    if (!result.success || !parseGatewayRunningFromJson(result.output)) {
      return "offline";
    }
    return "online";
  } catch {
    return "offline";
  }
}

export async function refreshInstanceStatuses(instances: AppInstance[]): Promise<AppInstance[]> {
  const next = await Promise.all(
    instances.map(async (instance) => ({
      ...instance,
      status: await probeInstanceStatus(instance),
      updatedAt: new Date().toISOString(),
    })),
  );
  return next;
}
