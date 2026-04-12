import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { supportsHostFileOps } from "../lib/instanceCapabilities";
import type { AppInstance, CommandResult } from "../types/core";
import { dispatchToInstance } from "./instanceCommandService";

export interface SkillItem {
  name: string;
  enabled: boolean;
  path?: string;
  source?: string;
}

function parseSkillList(output: string): SkillItem[] {
  const lines = output.split(/\r?\n/);
  const items: SkillItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.includes("│")) continue;

    const columns = line
      .split("│")
      .map((part) => part.trim())
      .filter(Boolean);

    if (columns.length < 4) continue;

    const statusColumn = columns[0];
    const skillColumn = columns[1];
    if (!/(ready|missing)/i.test(statusColumn)) continue;
    if (!skillColumn) continue;

    const name = skillColumn.replace(/^\p{Extended_Pictographic}\s*/u, "").trim();
    if (!name || items.some((item) => item.name === name)) continue;

    items.push({
      name,
      enabled: /ready/i.test(statusColumn),
      source: columns[columns.length - 1] || "openclaw",
    });
  }

  return items;
}

export async function listSkills(instance?: AppInstance): Promise<SkillItem[]> {
  const command = "openclaw skills list";
  const result = await dispatchToInstance(instance, command);
  if (!result.success) {
    throw new Error(result.error || result.output || "读取技能列表失败");
  }
  return parseSkillList(result.output || "");
}

export async function setSkillEnabled(name: string, enabled: boolean, instance?: AppInstance): Promise<CommandResult> {
  const action = enabled ? "enable" : "disable";
  return dispatchToInstance(instance, `openclaw skills ${action} ${JSON.stringify(name)}`);
}

export async function openSkillFolder(skill: SkillItem, instance?: AppInstance): Promise<string> {
  if (!supportsHostFileOps(instance)) {
    throw new Error("当前实例不是本机；从 manager 直接打开技能目录属于宿主文件系统能力边界，请到对应机器手动处理。");
  }

  const path = skill.path || `~/.openclaw/workspace/skills/${skill.name}`;
  try {
    await openPath(path);
  } catch {
    throw new Error(`打开技能目录仅在桌面宿主环境可用；当前可手动前往 ${path}`);
  }
  return path;
}

export async function pickSkillDirectory(): Promise<string | null> {
  try {
    return await invoke<string | null>("pick_directory");
  } catch {
    return null;
  }
}
