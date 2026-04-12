import type { AppInstance } from "../types/core";

interface InstanceSwitcherProps {
  instances: AppInstance[];
  currentInstanceId: string | null;
  onChange: (instanceId: string) => void;
  onRefreshStatuses: () => void;
  refreshingStatuses: boolean;
}

const statusLabel: Record<AppInstance["status"], string> = {
  online: "在线",
  offline: "离线",
  unknown: "未知",
};

const statusColor: Record<AppInstance["status"], string> = {
  online: "#16a34a",
  offline: "#dc2626",
  unknown: "#a3a3a3",
};

export function InstanceSwitcher({
  instances,
  currentInstanceId,
  onChange,
  onRefreshStatuses,
  refreshingStatuses,
}: InstanceSwitcherProps) {
  const current = instances.find((item) => item.id === currentInstanceId) || instances[0];

  return (
    <div className="version" style={{ opacity: 0.9, marginTop: 6 }}>
      <div style={{ fontSize: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span>当前实例</span>
        <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={onRefreshStatuses} disabled={refreshingStatuses}>
          {refreshingStatuses ? "刷新中" : "刷新状态"}
        </button>
      </div>
      <select
        value={currentInstanceId || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "var(--card-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 12,
        }}
      >
        {instances.map((instance) => (
          <option key={instance.id} value={instance.id}>
            {instance.name}（{statusLabel[instance.status]}）
          </option>
        ))}
      </select>
      {current ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor[current.status], display: "inline-block" }} />
            <span>实例连通性：{statusLabel[current.status]}</span>
          </div>
          <div>{current.baseUrl}</div>
        </div>
      ) : null}
    </div>
  );
}
