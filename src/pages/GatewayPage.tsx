import { Activity, Play, RefreshCw, RotateCcw, Square, Terminal } from "lucide-react";
import type { GatewayStatus } from "../types/core";

interface GatewayPageState {
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  gatewayStatus: GatewayStatus;
  systemLoading: string | null;
  liveLogs: string;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onRefresh: () => void | Promise<void>;
  onRefreshLogs: () => void | Promise<void>;
}

interface GatewayPageProps {
  gatewayState: GatewayPageState;
}

export function GatewayPage({ gatewayState }: GatewayPageProps) {
  const {
    currentInstance,
    gatewayStatus,
    systemLoading,
    liveLogs,
    onStart,
    onStop,
    onRestart,
    onRefresh,
    onRefreshLogs,
  } = gatewayState;

  const safePort = typeof gatewayStatus.port === "number" ? String(gatewayStatus.port) : "-";
  const safeUptime = typeof gatewayStatus.uptime === "string" && gatewayStatus.uptime.trim() ? gatewayStatus.uptime : "-";

  return (
    <div className="page-container">
      <div className="gateway-container">
        <div className="card">
          <div className="card-header">
            <Activity size={22} />
            <h2>Gateway 状态</h2>
          </div>

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
              {currentInstance ? ` ｜ ${currentInstance.type} ｜ ${currentInstance.baseUrl}` : " ｜ 请先选择要操作的实例"}
            </span>
            <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
              说明：侧栏里的“在线/离线”表示实例连通性；这里的“运行中/已停止”表示 Gateway 服务运行态，两者不是同一个概念。
            </div>
          </div>

          <div className="status-grid">
            <div className="status-card">
              <div className="status-label">运行状态</div>
              <div className={`status-value ${gatewayStatus.running ? "success" : "error"}`}>
                {gatewayStatus.running ? (
                  <>
                    <span className="status-dot"></span> 运行中
                  </>
                ) : (
                  <>
                    <span className="status-dot offline"></span> 已停止
                  </>
                )}
              </div>
            </div>
            <div className="status-card">
              <div className="status-label">端口</div>
              <div className="status-value">{safePort}</div>
            </div>
            <div className="status-card">
              <div className="status-label">运行时间 / 最近动作</div>
              <div className="status-value">{safeUptime}</div>
            </div>
          </div>


          <div className="gateway-controls">
            <button
              className={`btn ${gatewayStatus.running ? "btn-primary" : "btn-secondary"}`}
              onClick={onStart}
              disabled={gatewayStatus.running || systemLoading?.startsWith("gateway")}
            >
              <Play size={18} />
              {gatewayStatus.running ? "已启动" : "启动"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={onStop}
              disabled={!gatewayStatus.running || systemLoading?.startsWith("gateway")}
            >
              <Square size={18} />
              停止
            </button>
            <button
              className="btn btn-secondary"
              onClick={onRestart}
              disabled={systemLoading?.startsWith("gateway")}
            >
              <RotateCcw size={18} />
              重启
            </button>
            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              disabled={systemLoading?.startsWith("gateway")}
            >
              <RefreshCw size={18} />
              刷新
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Terminal size={22} />
              <h2>当前实时日志</h2>
            </div>
            <button className="btn btn-secondary" onClick={onRefreshLogs}>
              <RefreshCw size={16} /> 刷新日志
            </button>
          </div>
          <pre className="log-window">{liveLogs || "暂无日志，点击“刷新日志”加载。"}</pre>
        </div>
      </div>
    </div>
  );
}
