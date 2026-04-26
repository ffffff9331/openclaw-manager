import type { AppInstance } from "../types/core";
import { isLocalInstance } from "../lib/instanceCapabilities";
import { dispatchToInstance } from "./instanceCommandService";

const NO_INSTANCE_CHANNEL_RUNTIME_MESSAGE = "请先选择要操作的实例，频道 runtime 变更不再默认回退到本机 local。";

/**
 * 频道配置变更后，通知 Gateway 重载配置
 * 本地实例走 CLI 重启，远端实例走 HTTP API
 */
export async function applyChannelRuntimeChanges(instance?: AppInstance): Promise<string> {
  if (!instance) {
    return NO_INSTANCE_CHANNEL_RUNTIME_MESSAGE;
  }

  if (isLocalInstance(instance)) {
    try {
      const result = await dispatchToInstance(instance, "openclaw gateway restart");
      if (result.success) {
        return "频道配置已保存，Gateway 正在重载。";
      }
      return `频道配置已保存，但 Gateway 重载失败：${result.error || "未知错误"}`;
    } catch {
      return "频道配置已保存；Gateway 重载失败，请手动到 Gateway 页重启。";
    }
  }

  // 远端实例：尝试通过 HTTP 通知
  try {
    const baseUrl = instance.baseUrl?.replace(/\/$/, "") || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (instance.apiKey?.trim()) {
      headers.Authorization = `Bearer ${instance.apiKey.trim()}`;
    }
    await fetch(`${baseUrl}/v1/config/reload`, { method: "POST", headers });
    return "频道配置已保存，远端 Gateway 重载请求已发送。";
  } catch {
    return "频道配置已保存；远端 Gateway 重载失败，请手动重启目标实例的 Gateway。";
  }
}
