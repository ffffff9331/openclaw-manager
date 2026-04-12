import type { AppInstance, BackupArtifact, BackupCreateOptions, CommandResult } from "../types/core";
import { dispatchDetachedLocalCommand } from "./commandService";
import { dispatchToInstance, readFromInstance, runRequiredInstanceCommand } from "./instanceCommandService";

function quoteShellArg(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildBackupCreateCommand(options: BackupCreateOptions = {}) {
  const parts = ["openclaw backup create"];

  if (options.output?.trim()) {
    parts.push(`--output ${quoteShellArg(options.output.trim())}`);
  }
  if (options.verify) {
    parts.push("--verify");
  }
  if (options.includeWorkspace === false) {
    parts.push("--no-include-workspace");
  }
  if (options.onlyConfig) {
    parts.push("--only-config");
  }
  if (options.dryRun) {
    parts.push("--dry-run");
  }
  if (!options.dryRun) {
    parts.push("--json");
  }

  return parts.join(" ");
}

function extractArchivePath(output: string) {
  try {
    const parsed = JSON.parse(output);
    if (typeof parsed?.archivePath === "string") return parsed.archivePath;
    if (typeof parsed?.path === "string") return parsed.path;
  } catch {
    // ignore
  }

  const match = output.match(/([~/\w.-]+openclaw-backup[^\s]*\.(?:tar\.gz|tgz|zip))/i);
  return match?.[1];
}

export async function createBackup(options: BackupCreateOptions = {}, instance?: AppInstance): Promise<BackupArtifact> {
  const command = buildBackupCreateCommand(options);

  if (!instance || instance.type === "local") {
    const result = await dispatchDetachedLocalCommand(command);
    if (!result.success) {
      throw new Error(result.error || result.output || "创建备份失败");
    }
    return {
      command,
      output: result.output || "命令已投递",
      archivePath: options.output?.trim() || undefined,
    };
  }

  const output = await runRequiredInstanceCommand(instance, command, "创建备份失败");
  return {
    command,
    output,
    archivePath: extractArchivePath(output),
  };
}

export async function verifyBackup(archivePath: string, instance?: AppInstance): Promise<BackupArtifact> {
  const safePath = archivePath.trim();
  if (!safePath) {
    throw new Error("备份文件路径不能为空");
  }

  const command = `openclaw backup verify ${quoteShellArg(safePath)} --json`;
  const output = await runRequiredInstanceCommand(instance, command, "校验备份失败");
  return {
    command,
    output,
    archivePath: safePath,
  };
}

export async function restoreBackup(archivePath: string, instance?: AppInstance): Promise<BackupArtifact> {
  const safePath = archivePath.trim();
  if (!safePath) {
    throw new Error("备份文件路径不能为空");
  }

  const command = `openclaw backup restore ${quoteShellArg(safePath)}`;

  if (!instance || instance.type === "local") {
    const result = await dispatchDetachedLocalCommand(command);
    if (!result.success) {
      throw new Error(result.error || result.output || "还原备份失败");
    }
    return {
      command,
      output: result.output || "还原命令已投递",
      archivePath: safePath,
    };
  }

  const output = await runRequiredInstanceCommand(instance, command, "还原备份失败");
  return {
    command,
    output,
    archivePath: safePath,
  };
}

export async function previewBackup(options: BackupCreateOptions = {}, instance?: AppInstance): Promise<CommandResult> {
  return readFromInstance(instance, buildBackupCreateCommand({ ...options, dryRun: true }));
}
