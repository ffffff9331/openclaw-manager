import type {
  AppInstance,
  CommandResultState,
  CustomCommandFormState,
  CustomCommandItem,
} from "../types/core";
import { formatActionError } from "../lib/errorMessage";
import { runInstanceCommand } from "./instanceCommandService";

const CUSTOM_COMMANDS_KEY = "customCommands";

function buildCommandResult(command: string, result: { success: boolean; output?: string | null; error?: string | null }): CommandResultState {
  const output = (result.output || result.error || "").trim();
  const fallbackOutput = result.success ? "命令执行成功（无文本输出）" : "命令执行失败（无文本输出）";

  return {
    cmd: command,
    output: output || fallbackOutput,
    success: result.success,
    error: result.success ? undefined : (output || "命令执行失败"),
  };
}

export async function runQuickCommand(command: string, instance?: AppInstance): Promise<CommandResultState> {
  try {
    const result = await runInstanceCommand(instance, command);
    return buildCommandResult(command, result);
  } catch (e) {
    const message = formatActionError(`执行命令失败（${command}）`, e);
    return { cmd: command, output: message, success: false, error: message };
  }
}

export function loadCustomCommands(): CustomCommandItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COMMANDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load custom commands:", e);
    return [];
  }
}

export function saveCustomCommands(commands: CustomCommandItem[]) {
  localStorage.setItem(CUSTOM_COMMANDS_KEY, JSON.stringify(commands));
}

export function appendCustomCommand(commands: CustomCommandItem[], newCmd: CustomCommandFormState): CustomCommandItem[] {
  if (!newCmd.cmd || !newCmd.label) return commands;
  return [...commands, { cmd: newCmd.cmd, label: newCmd.label, desc: newCmd.desc }];
}

export function removeCustomCommand(commands: CustomCommandItem[], cmdToDelete: string): CustomCommandItem[] {
  return commands.filter((command) => command.cmd !== cmdToDelete);
}
