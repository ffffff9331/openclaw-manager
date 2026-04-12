export type ClosureLevel = "本轮已收口" | "阶段进行中" | "待人工验收" | "阶段已完成";

export interface AcceptanceCheckItem {
  label: string;
  status: "已完成" | "待补章" | "未开始";
}

export interface ProjectStageSnapshot {
  title: string;
  phase: string;
  summary: string;
  closureLevel: ClosureLevel;
  acceptanceStatus: string;
  remainingItems: string[];
  latestCheck: string;
  riskItems: string[];
  acceptanceChecks: AcceptanceCheckItem[];
}

export const currentProjectStage: ProjectStageSnapshot = {
  title: "项目阶段",
  phase: "阶段 3 / 4",
  summary: "代码侧已基本收口，当前主线已从继续补功能切到状态表达增强与待验收收口。",
  closureLevel: "待人工验收",
  acceptanceStatus: "桌面端人工验收补章待完成",
  remainingItems: ["桌面端集中人工验收", "按验收结果决定是否修最后一批回归", "人工补章后再宣布阶段 4 正式完成"],
  latestCheck: "最近验证：npm run build 通过",
  riskItems: ["当前无代码阻塞", "正式完成口径仍依赖人工补章", "后续增强应继续守住 manager / openclaw 本体边界"],
  acceptanceChecks: [
    { label: "代码侧收口", status: "已完成" },
    { label: "Web preview 回归", status: "已完成" },
    { label: "桌面端人工验收", status: "待补章" },
    { label: "阶段 4 正式完成结论", status: "待补章" },
  ],
};
