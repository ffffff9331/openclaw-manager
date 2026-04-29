import { requestWithInstance } from "../lib/instanceTransport";
import { dispatchLocalCommand, dispatchWslCommand, readLocalCommand, readWslCommand, readDockerCommand, dispatchDockerCommand } from "./commandService";
import type { AppInstance, CommandResult } from "../types/core";

export type InstanceReadCommand = string;
export type InstanceDispatchCommand = string;

const STRICT_INSTANCE_COMMAND_PREFIXES = [
  "openclaw gateway ",
  "openclaw logs",
  "openclaw config get",
  "openclaw config set",
  "openclaw config unset",
];

function shouldRequireExplicitInstance(command: string) {
  const normalized = command.trim();
  return STRICT_INSTANCE_COMMAND_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function buildMissingInstanceResult(command: string): CommandResult {
  return {
    success: false,
    output: "",
    error: `命令需要显式实例上下文，已阻止默认回退到本机 local：${command}`,
  };
}

async function requestLocalRead(command: InstanceReadCommand): Promise<CommandResult> {
  return readLocalCommand(command);
}

async function requestLocalDispatch(command: InstanceDispatchCommand): Promise<CommandResult> {
  return dispatchLocalCommand(command);
}

async function requestRemoteCommand(instance: AppInstance, command: string): Promise<CommandResult> {
  const result = await requestWithInstance(instance, {
    path: instance.apiBasePath,
    command,
    accessMode: "dispatch",
  });
  if (typeof result === "object" && result && "success" in result) {
    return result as CommandResult;
  }
  return {
    success: false,
    output: "",
    error: "实例返回结果格式不正确",
  };
}

function getDockerContainerName(instance: AppInstance): string {
  return (instance as AppInstance & { containerName?: string }).containerName || "openclaw";
}

// 检测 pairing required 错误并提取 requestId
function extractPairingRequestId(error?: string): string | null {
  if (!error) return null;
  const match = error.match(/requestId[:\s]+([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

// 自动批准设备配对
async function autoApproveDevice(instance: AppInstance | undefined, requestId: string): Promise<boolean> {
  try {
    let result: CommandResult;
    if (!instance || instance.type === "local") {
      result = await dispatchLocalCommand(`openclaw devices approve ${requestId}`);
    } else if (instance.type === "wsl") {
      result = await dispatchWslCommand(`openclaw devices approve ${requestId}`);
    } else {
      return false; // 远程实例无法自动批准
    }
    return result.success;
  } catch {
    return false;
  }
}

export async function readFromInstance(instance: AppInstance | undefined, command: InstanceReadCommand, _retried = false): Promise<CommandResult> {
  if (instance) {
    let result: CommandResult;
    if (instance.type === "local") {
      result = await requestLocalRead(command);
    } else if (instance.type === "wsl") {
      result = await readWslCommand(command);
    } else if (instance.type === "docker") {
      result = await readDockerCommand(getDockerContainerName(instance), command);
    } else {
      result = await requestRemoteCommand(instance, command);
    }
    // 自动配对重试（最多一次）
    if (!result.success && !_retried) {
      const requestId = extractPairingRequestId(result.error || result.output);
      if (requestId) {
        const approved = await autoApproveDevice(instance, requestId);
        if (approved) return readFromInstance(instance, command, true);
      }
    }
    return result;
  }

  if (shouldRequireExplicitInstance(command)) {
    return buildMissingInstanceResult(command);
  }

  return requestLocalRead(command);
}

export async function dispatchToInstance(instance: AppInstance | undefined, command: InstanceDispatchCommand, _retried = false): Promise<CommandResult> {
  if (instance) {
    let result: CommandResult;
    if (instance.type === "local") {
      result = await requestLocalDispatch(command);
    } else if (instance.type === "wsl") {
      result = await dispatchWslCommand(command);
    } else if (instance.type === "docker") {
      result = await dispatchDockerCommand(getDockerContainerName(instance), command);
    } else {
      result = await requestRemoteCommand(instance, command);
    }
    // 自动配对重试（最多一次）
    if (!result.success && !_retried) {
      const requestId = extractPairingRequestId(result.error || result.output);
      if (requestId) {
        const approved = await autoApproveDevice(instance, requestId);
        if (approved) return dispatchToInstance(instance, command, true);
      }
    }
    return result;
  }

  if (shouldRequireExplicitInstance(command)) {
    return buildMissingInstanceResult(command);
  }

  return requestLocalDispatch(command);
}

export async function runInstanceCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  return dispatchToInstance(instance, command);
}

export async function runRequiredInstanceCommand(instance: AppInstance | undefined, command: string, fallbackMessage: string): Promise<string> {
  const result = await dispatchToInstance(instance, command);
  if (!result.success) {
    throw new Error(result.error || result.output || fallbackMessage);
  }
  return result.output || "";
}
