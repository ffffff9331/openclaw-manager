import type { AppInstance, AppInstanceStatus } from "../types/core";
import { readFromInstance } from "./instanceCommandService";

function canUseTauriInvoke() {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof tauriInternals?.invoke === "function";
}

function isWebPreview() {
  return typeof window !== "undefined" && !canUseTauriInvoke();
}

async function probeViaHttpHealth(instance: AppInstance): Promise<AppInstanceStatus> {
  const healthUrl = isWebPreview() && instance.type === "local"
    ? "/__openclaw_health"
    : new URL(instance.healthPath || "/health", instance.baseUrl).toString();

  try {
    const response = await fetch(healthUrl, { method: "GET" });
    return response.ok ? "online" : "offline";
  } catch {
    return isWebPreview() && instance.type === "local" ? "unknown" : "offline";
  }
}

async function probeLocalInstance(instance: AppInstance): Promise<AppInstanceStatus> {
  if (!canUseTauriInvoke()) {
    return probeViaHttpHealth(instance);
  }

  try {
    const result = await readFromInstance(instance, "openclaw gateway status --json");
    if (result.success) {
      return "online";
    }
    return probeViaHttpHealth(instance);
  } catch {
    return probeViaHttpHealth(instance);
  }
}

export async function probeInstanceStatus(instance: AppInstance): Promise<AppInstanceStatus> {
  if (instance.type === "local") {
    return probeLocalInstance(instance);
  }

  try {
    const result = await readFromInstance(instance, "openclaw gateway status --json");
    if (!result.success) {
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
