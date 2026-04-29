import type { AppInstance, AppInstanceStatus } from "../types/core";
import { canUseTauriInvoke, isWebPreview } from "../lib/platform";
import { parseGatewayRunningFromJson } from "../lib/cliOutputParser";
import { readFromInstance } from "./instanceCommandService";

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
  const BATCH_SIZE = 5;
  const results: AppInstance[] = [];
  for (let i = 0; i < instances.length; i += BATCH_SIZE) {
    const batch = instances.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (instance) => ({
        ...instance,
        status: await probeInstanceStatus(instance),
        updatedAt: new Date().toISOString(),
      })),
    );
    results.push(...batchResults);
  }
  return results;
}
