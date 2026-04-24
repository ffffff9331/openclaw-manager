import { invoke } from "@tauri-apps/api/core";
import type { CommandResult } from "../types/core";

function getTauriUnavailableResult(action: string): CommandResult {
  return {
    success: false,
    output: "",
    error: `${action} 仅在 Tauri 桌面环境可用；当前是 web preview，已跳过宿主命令执行。`,
  };
}

function canUseTauriInvoke() {
  if (typeof window === "undefined") return false;
  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof invoke === "function" && typeof tauriInternals?.invoke === "function";
}

// 兼容桥：仅保留给旧路径和调试路径，业务新代码应优先走 readLocalCommand / dispatchLocalCommand。
export async function runOpenClawCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`运行命令（${command}）`);
  }
  return invoke<CommandResult>("run_command", { command });
}

export async function readLocalCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`读取命令（${command}）`);
  }
  return invoke<CommandResult>("read_command", { command });
}

export async function readWslCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`读取 WSL2 命令（${command}）`);
  }
  return invoke<CommandResult>("read_wsl_command", { command });
}

export async function dispatchLocalCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`投递命令（${command}）`);
  }
  return invoke<CommandResult>("dispatch_command", { command });
}

export async function dispatchWslCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`投递 WSL2 命令（${command}）`);
  }
  return invoke<CommandResult>("dispatch_wsl_command", { command });
}

export async function dispatchDetachedLocalCommand(command: string): Promise<CommandResult> {
  if (!canUseTauriInvoke()) {
    return getTauriUnavailableResult(`后台投递命令（${command}）`);
  }
  return invoke<CommandResult>("dispatch_detached_command", { command });
}
