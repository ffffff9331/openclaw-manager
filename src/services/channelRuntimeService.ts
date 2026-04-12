import type { AppInstance } from "../types/core";

export async function applyChannelRuntimeChanges(_instance?: AppInstance) {
  return "频道配置已保存；如当前实例正在运行，请到 Gateway 页按需重载。";
}
