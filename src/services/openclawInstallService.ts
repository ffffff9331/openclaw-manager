import { isLocalInstance } from "../lib/instanceCapabilities";
import { isWindows } from "../lib/platform";
import type { AppInstance, CommandResult } from "../types/core";
import { dispatchDetachedLocalCommand } from "./commandService";
import { dispatchToInstance } from "./instanceCommandService";

const NO_INSTANCE_INSTALL_MESSAGE = "请先选择要操作的实例，安装/卸载操作不再默认回退到本机 local。";

function getInstallCommand(): string {
  return "npm install -g openclaw@latest";
}

function getRemoveDataCommand(instance?: AppInstance): string {
  if (instance?.type === "wsl") {
    return "rm -rf ~/.openclaw";
  }
  if (isWindows()) {
    return 'rmdir /s /q "%USERPROFILE%\\.openclaw"';
  }
  return "rm -rf ~/.openclaw";
}

function getUninstallCommand(): string {
  return "npm uninstall -g openclaw";
}

function getCheckInstalledCommand(): string {
  return "openclaw --version";
}

function getStartGatewayCommand(): string {
  return "openclaw gateway start";
}

async function dispatchHighImpactCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  if (!instance) {
    return {
      success: false,
      output: "",
      error: NO_INSTANCE_INSTALL_MESSAGE,
    };
  }

  if (isLocalInstance(instance)) {
    return dispatchDetachedLocalCommand(command);
  }
  return dispatchToInstance(instance, command);
}

export async function checkOpenClawInstalled(instance?: AppInstance): Promise<{ installed: boolean; version?: string }> {
  if (!instance) {
    return { installed: false };
  }

  const result = await dispatchHighImpactCommand(instance, getCheckInstalledCommand());
  if (result.success && result.output) {
    const version = result.output.trim();
    return { installed: true, version };
  }
  return { installed: false };
}

export async function installOpenClaw(instance?: AppInstance): Promise<{ success: boolean; output: string; error?: string }> {
  if (!instance) {
    return {
      success: false,
      output: "",
      error: NO_INSTANCE_INSTALL_MESSAGE,
    };
  }

  const result = await dispatchHighImpactCommand(instance, getInstallCommand());
  if (!result.success) {
    return {
      success: false,
      output: result.output,
      error: result.error || "安装 OpenClaw 失败",
    };
  }

  return {
    success: true,
    output: result.output,
  };
}

export async function startOpenClawGateway(instance?: AppInstance): Promise<CommandResult> {
  if (!instance) {
    return {
      success: false,
      output: "",
      error: NO_INSTANCE_INSTALL_MESSAGE,
    };
  }

  return dispatchHighImpactCommand(instance, getStartGatewayCommand());
}

export async function removeOpenClawData(instance?: AppInstance) {
  const result = await dispatchHighImpactCommand(instance, getRemoveDataCommand(instance));
  if (!result.success) {
    throw new Error(result.error || result.output || "删除 OpenClaw 数据失败");
  }
}

export async function uninstallOpenClaw(instance?: AppInstance) {
  const uninstallResult = await dispatchHighImpactCommand(instance, getUninstallCommand());
  if (!uninstallResult.success) {
    throw new Error(uninstallResult.error || uninstallResult.output || "卸载 OpenClaw 失败");
  }
  await removeOpenClawData(instance);
}
