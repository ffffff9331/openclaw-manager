import { requestWithInstance } from "../lib/instanceTransport";
import { dispatchLocalCommand, dispatchWslCommand, readLocalCommand, readWslCommand, readDockerCommand, dispatchDockerCommand } from "./commandService";
import type { AppInstance, CommandResult } from "../types/core";

export type InstanceReadCommand = string;
export type InstanceDispatchCommand = string;

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

export async function readFromInstance(instance: AppInstance | undefined, command: InstanceReadCommand): Promise<CommandResult> {
  if (instance) {
    if (instance.type === "local") {
      return requestLocalRead(command);
    }
    if (instance.type === "wsl") {
      return readWslCommand(command);
    }
    if (instance.type === "docker") {
      return readDockerCommand(getDockerContainerName(instance), command);
    }
    return requestRemoteCommand(instance, command);
  }

  return requestLocalRead(command);
}

export async function dispatchToInstance(instance: AppInstance | undefined, command: InstanceDispatchCommand): Promise<CommandResult> {
  if (instance) {
    if (instance.type === "local") {
      return requestLocalDispatch(command);
    }
    if (instance.type === "wsl") {
      return dispatchWslCommand(command);
    }
    if (instance.type === "docker") {
      return dispatchDockerCommand(getDockerContainerName(instance), command);
    }
    return requestRemoteCommand(instance, command);
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
