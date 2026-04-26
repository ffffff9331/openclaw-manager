import { isLocalInstance } from "../lib/instanceCapabilities";
import { isWindows } from "../lib/platform";
import type { AppInstance, CommandResult } from "../types/core";
import { dispatchDetachedLocalCommand } from "./commandService";
import { dispatchToInstance } from "./instanceCommandService";

const NO_INSTANCE_INSTALL_MESSAGE = "请先选择要操作的实例，安装/卸载操作不再默认回退到本机 local。";

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
