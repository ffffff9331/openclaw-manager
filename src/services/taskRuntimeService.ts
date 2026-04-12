import type { AppInstance, CommandResultState, CustomCommandItem } from "../types/core";
import { runQuickCommand } from "./taskService";

export async function executeTaskCommand(item: Pick<CustomCommandItem, "cmd" | "action">, instance?: AppInstance): Promise<CommandResultState> {
  if (item.action === "restartGateway") {
    return {
      cmd: item.cmd,
      output: "快捷指令页不再直接重启 Gateway。请前往 Gateway 页按需执行重载/重启。",
      success: true,
    };
  }

  return runQuickCommand(item.cmd, instance);
}
