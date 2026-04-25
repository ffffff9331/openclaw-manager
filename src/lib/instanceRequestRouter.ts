import { dispatchLocalCommand, dispatchWslCommand, readLocalCommand, readWslCommand, readDockerCommand, dispatchDockerCommand } from "../services/commandService";
import type { AppInstance, CommandResult } from "../types/core";

export interface InstanceRequestOptions {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  command?: string;
  accessMode?: "read" | "dispatch";
}

export async function requestViaInstance(
  instance: AppInstance,
  options: InstanceRequestOptions,
): Promise<CommandResult | unknown> {
  if (instance.type === "local" || instance.type === "wsl" || instance.type === "docker") {
    if (options.command) {
      const accessMode = options.accessMode ?? "dispatch";
      if (instance.type === "wsl") {
        return accessMode === "read" ? readWslCommand(options.command) : dispatchWslCommand(options.command);
      }
      if (instance.type === "docker") {
        const containerName = (instance as AppInstance & { containerName?: string }).containerName || "openclaw";
        return accessMode === "read" ? readDockerCommand(containerName, options.command) : dispatchDockerCommand(containerName, options.command);
      }
      return accessMode === "read" ? readLocalCommand(options.command) : dispatchLocalCommand(options.command);
    }

    const typeLabels: Record<string, string> = { wsl: "WSL2", docker: "Docker", local: "本地" };
    return {
      success: false,
      output: "",
      error: `${typeLabels[instance.type] || instance.type} 实例请求缺少 command 参数`,
    } satisfies CommandResult;
  }

  const baseUrl = instance.baseUrl?.replace(/\/$/, "") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (instance.apiKey?.trim()) {
    headers.Authorization = `Bearer ${instance.apiKey.trim()}`;
  }

  try {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `网络错误：${err instanceof Error ? err.message : String(err)}`,
    } satisfies CommandResult;
  }
}
