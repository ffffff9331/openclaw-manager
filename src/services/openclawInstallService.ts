import { isLocalInstance } from "../lib/instanceCapabilities";
import type { AppInstance, CommandResult } from "../types/core";
import { dispatchDetachedLocalCommand } from "./commandService";
import { dispatchToInstance } from "./instanceCommandService";

const REMOVE_OPENCLAW_DATA_COMMAND = "python3 - <<'PY'\nimport os, shutil\nshutil.rmtree(os.path.expanduser('~/.openclaw'), ignore_errors=True)\nprint('removed')\nPY";

async function dispatchHighImpactCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  if (isLocalInstance(instance)) {
    return dispatchDetachedLocalCommand(command);
  }
  return dispatchToInstance(instance, command);
}

export async function removeOpenClawData(instance?: AppInstance) {
  await dispatchHighImpactCommand(instance, REMOVE_OPENCLAW_DATA_COMMAND);
}

export async function uninstallOpenClaw(instance?: AppInstance) {
  await dispatchHighImpactCommand(instance, "npm uninstall -g openclaw");
  await removeOpenClawData(instance);
}
