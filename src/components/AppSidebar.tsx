import type { LucideIcon } from "lucide-react";
import {
  Cpu,
  FileText,
  House,
  ListTodo,
  MessageSquare,
  Moon,
  Puzzle,
  Settings,
  Sun,
  Wrench,
} from "lucide-react";
import { InstanceSwitcher } from "./InstanceSwitcher";
import type { AppInstance } from "../types/core";

export type TabKey = "overview" | "chat" | "gateway" | "tasks" | "models" | "skills" | "doctor" | "applogs" | "settings";

interface AppSidebarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  appVersion: string;
  instances: AppInstance[];
  currentInstanceId: string | null;
  onChangeInstance: (instanceId: string) => void;
  onAddInstance: () => void;
  onRefreshStatuses: () => void;
  refreshingStatuses: boolean;
  gatewayIcon: LucideIcon;
}

interface NavItem {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

const staticNavItems: NavItem[] = [
  { key: "overview", label: "总览", icon: House },
  { key: "chat", label: "对话工具", icon: MessageSquare },
  { key: "doctor", label: "测试诊断", icon: Wrench },
  { key: "models", label: "模型", icon: Cpu },
  { key: "tasks", label: "任务", icon: ListTodo },
  { key: "skills", label: "技能", icon: Puzzle },
  { key: "applogs", label: "App日志", icon: FileText },
  { key: "settings", label: "设置", icon: Settings },
];

export function AppSidebar({
  activeTab,
  setActiveTab,
  darkMode,
  onToggleTheme,
  appVersion,
  instances,
  currentInstanceId,
  onChangeInstance,
  onAddInstance,
  onRefreshStatuses,
  refreshingStatuses,
  gatewayIcon: GatewayIcon,
}: AppSidebarProps) {
  const navItems: NavItem[] = [
    staticNavItems[0],
    { key: "gateway", label: "Gateway", icon: GatewayIcon },
    ...staticNavItems.slice(1),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div />
        <button className="theme-toggle" onClick={onToggleTheme}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="version" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>v{appVersion}</span>
          <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={onAddInstance}>
            新增实例
          </button>
        </div>
        <div className="version" style={{ opacity: 0.75, marginTop: 6 }}>
          <span>实例 {instances.length}</span>
        </div>
        <InstanceSwitcher
          instances={instances}
          currentInstanceId={currentInstanceId}
          onChange={onChangeInstance}
          onRefreshStatuses={onRefreshStatuses}
          refreshingStatuses={refreshingStatuses}
        />
      </div>
    </aside>
  );
}
