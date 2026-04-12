import { FileText, RefreshCw, Trash2 } from "lucide-react";

interface AppLogsPageState {
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  appLogs: string;
  auditLogs: import("../types/core").AuditLogEntry[];
  onRefresh: () => void;
  onClearAudit: () => void;
}

interface AppLogsPageProps {
  appLogsState: AppLogsPageState;
}

export function AppLogsPage({ appLogsState }: AppLogsPageProps) {
  const { currentInstance, appLogs, auditLogs, onRefresh, onClearAudit } = appLogsState;
  return (
    <div className="page-container">
      <div
        style={{
          marginBottom: 16,
          padding: "10px 12px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        当前实例：
        <strong>{currentInstance?.name || "未选择实例"}</strong>
        <span style={{ color: "var(--text-secondary)" }}>
          {currentInstance ? ` ｜ ${currentInstance.type} ｜ ${currentInstance.baseUrl}` : " ｜ 请先选择要查看日志的实例"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "16px" }}>
        <button className="btn btn-primary" onClick={onRefresh} style={{ flex: 1 }}>
          <RefreshCw size={16} /> 刷新日志
        </button>
        <button className="btn btn-secondary" onClick={onClearAudit}>
          <Trash2 size={16} /> 清空审计
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <FileText size={22} />
          <h2>关键操作审计日志</h2>
        </div>
        {auditLogs.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {auditLogs.map((item) => (
              <div key={item.id} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <strong>{item.action}</strong>
                  <span style={{ color: "var(--text-secondary)" }}>{item.at}</span>
                </div>
                <div><strong>目标：</strong>{item.target}</div>
                <div><strong>结果：</strong>{item.result}</div>
                {item.detail ? <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>{item.detail}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>暂无关键操作审计日志</div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <FileText size={22} />
          <h2>App日志</h2>
        </div>
        {appLogs ? (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              maxHeight: 500,
              overflow: "auto",
              background: "var(--bg-secondary)",
              padding: 16,
              borderRadius: 8,
            }}
          >
            {appLogs}
          </pre>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-secondary)",
            }}
          >
            暂无日志，点击上方按钮加载
          </div>
        )}
      </div>
    </div>
  );
}
