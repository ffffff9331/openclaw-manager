import { Puzzle, RefreshCw } from "lucide-react";
import type { SkillItem } from "../services/skillService";

interface SkillsPageState {
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  skills: SkillItem[];
  skillsLoading: boolean;
  skillsStatus: string;
  skillsError: string;
  onRefresh: () => void;
  onToggle: (skill: SkillItem) => void;
  onEdit: (skill: SkillItem) => void;
}

interface SkillsPageProps {
  skillsState: SkillsPageState;
}

export function SkillsPage({ skillsState }: SkillsPageProps) {
  const { currentInstance, skills, skillsLoading, skillsStatus, skillsError, onRefresh, onToggle, onEdit } = skillsState;

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">
          <Puzzle size={22} />
          <h2>技能管理</h2>
        </div>

        <div style={{ marginBottom: 16, padding: "10px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}>
          当前实例：<strong>{currentInstance?.name || "未选择实例"}</strong>
          <span style={{ color: "var(--text-secondary)" }}>
            {currentInstance ? ` ｜ ${currentInstance.type} ｜ ${currentInstance.baseUrl}` : " ｜ 请先选择实例"}
          </span>
        </div>

        <div style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>
          这里只做 manager 该做的管理面：技能列表、启用/禁用、打开目录编辑入口；不承载 openclaw 本体的技能执行逻辑。
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={onRefresh}>
            <RefreshCw size={16} /> 刷新技能
          </button>
        </div>

        {skillsStatus ? <div style={{ marginBottom: 8, fontSize: 13 }}>{skillsStatus}</div> : null}
        {skillsError ? <div style={{ marginBottom: 8, fontSize: 13, color: "var(--error)" }}>{skillsError}</div> : null}

        <div className="settings-list">
          {skillsLoading ? (
            <div className="setting-item"><div className="setting-info">加载中…</div></div>
          ) : skills.length ? (
            skills.map((skill) => (
              <div key={skill.name} className="setting-item">
                <div className="setting-info">
                  <div className="setting-name">{skill.name}</div>
                  <div className="setting-description">状态：{skill.enabled ? "已启用" : "已禁用"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => onEdit(skill)}>编辑入口</button>
                  <button className={`btn ${skill.enabled ? "btn-danger" : "btn-primary"}`} onClick={() => onToggle(skill)}>
                    {skill.enabled ? "禁用" : "启用"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="setting-item"><div className="setting-info">暂无技能数据</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
