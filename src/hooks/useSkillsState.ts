import { useCallback, useState } from "react";
import { formatActionError } from "../lib/errorMessage";
import type { AppInstance } from "../types/core";
import { listSkills, openSkillFolder, setSkillEnabled, type SkillItem } from "../services/skillService";

interface UseSkillsStateOptions {
  currentInstance?: AppInstance;
  setSystemLoading: (value: string | null) => void;
}

export interface SkillsState {
  skills: SkillItem[];
  skillsLoading: boolean;
  skillsStatus: string;
  skillsError: string;
  refreshSkills: () => Promise<void>;
  toggleSkillEnabled: (skill: SkillItem) => Promise<void>;
  editSkill: (skill: SkillItem) => Promise<void>;
}

export function useSkillsState({ currentInstance, setSystemLoading }: UseSkillsStateOptions): SkillsState {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsStatus, setSkillsStatus] = useState("");
  const [skillsError, setSkillsError] = useState("");

  const refreshSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError("");
    try {
      const items = await listSkills(currentInstance);
      setSkills(items);
      setSkillsStatus(`已加载 ${items.length} 个技能`);
    } catch (e) {
      const message = formatActionError("加载技能列表失败", e);
      setSkillsError(message);
      setSkillsStatus(message);
    } finally {
      setSkillsLoading(false);
    }
  }, [currentInstance]);

  const toggleSkillEnabled = useCallback(async (skill: SkillItem) => {
    setSystemLoading("skills-toggle");
    setSkillsError("");
    try {
      const nextEnabled = !skill.enabled;
      const result = await setSkillEnabled(skill.name, nextEnabled, currentInstance);
      if (!result.success) {
        throw new Error(result.error || result.output || "切换技能状态失败");
      }
      setSkills((prev) => prev.map((item) => (item.name === skill.name ? { ...item, enabled: nextEnabled } : item)));
      setSkillsStatus(`技能 ${skill.name} 已${nextEnabled ? "启用" : "禁用"}`);
    } catch (e) {
      const message = formatActionError("切换技能状态失败", e);
      setSkillsError(message);
      setSkillsStatus(message);
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, setSystemLoading]);

  const editSkill = useCallback(async (skill: SkillItem) => {
    setSystemLoading("skills-edit");
    try {
      const path = await openSkillFolder(skill, currentInstance);
      setSkillsStatus(`已打开技能目录：${path}`);
    } catch (e) {
      const message = formatActionError("打开技能目录失败", e);
      setSkillsError(message);
      setSkillsStatus(message);
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, setSystemLoading]);

  return {
    skills,
    skillsLoading,
    skillsStatus,
    skillsError,
    refreshSkills,
    toggleSkillEnabled,
    editSkill,
  };
}
