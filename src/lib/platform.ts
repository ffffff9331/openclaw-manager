/**
 * 跨平台检测工具
 * 通过 navigator.userAgent 推断，或通过 Tauri invoke 获取后端 os 信息
 */

export type Platform = "macos" | "windows" | "linux" | "unknown";

let cachedPlatform: Platform | null = null;

function detectFromNavigator(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export function getPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;
  cachedPlatform = detectFromNavigator();
  return cachedPlatform;
}

export function isMacOS(): boolean {
  return getPlatform() === "macos";
}

export function isWindows(): boolean {
  return getPlatform() === "windows";
}

export function isLinux(): boolean {
  return getPlatform() === "linux";
}

/** macOS 专属功能是否可用（LaunchAgent 等） */
export function supportsMacOSServices(): boolean {
  return isMacOS();
}

/** 检测当前是否运行在 Tauri 桌面环境 */
export function canUseTauriInvoke(): boolean {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof tauriInternals?.invoke === "function";
}

/** 检测当前是否为 Web 预览模式（非 Tauri） */
export function isWebPreview(): boolean {
  return typeof window !== "undefined" && !canUseTauriInvoke();
}
