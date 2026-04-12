import { ArrowDown, ArrowUp, Pencil, PlugZap, Trash2 } from "lucide-react";
import type { ModelConfig } from "../types/core";

interface ModelCardProps {
  model: ModelConfig;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  connectivityMessage?: string;
  connectivityOk?: boolean;
  connectivityLoading?: boolean;
  busy?: boolean;
  onEdit: (model: ModelConfig) => void;
  onDelete: (provider: string, modelId: string) => Promise<void>;
  onSetDefault: (modelId: string, provider: string) => Promise<void>;
  onTestConnectivity: (model: ModelConfig) => Promise<void>;
  onMove: (provider: string, modelId: string, direction: "up" | "down") => Promise<void>;
}

export function ModelCard({
  model,
  isCurrent,
  isFirst,
  isLast,
  connectivityMessage,
  connectivityOk,
  connectivityLoading,
  busy,
  onEdit,
  onDelete,
  onSetDefault,
  onTestConnectivity,
  onMove,
}: ModelCardProps) {
  const canDelete = !isCurrent;

  return (
    <div
      style={{
        padding: "16px",
        background: "var(--bg-card)",
        border: `1px solid ${isCurrent ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "16px" }}>
              {model.name}{isCurrent ? "（当前）" : ""}
            </span>
            {isCurrent && (
              <span style={{ padding: "2px 8px", background: "#22C55E", color: "white", borderRadius: "999px", fontSize: "12px" }}>
                当前使用
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
            <div>
              <span style={{ color: "gray" }}>ID: </span>
              <code style={{ background: "var(--bg-hover)", padding: "2px 6px", borderRadius: "4px" }}>{model.id}</code>
            </div>
            <div>
              <span style={{ color: "gray" }}>上下文: </span>
              <span>{model.contextWindow?.toLocaleString() || "?"} tokens</span>
            </div>
            <div>
              <span style={{ color: "gray" }}>Max: </span>
              <span>{model.maxTokens?.toLocaleString() || "?"} tokens</span>
            </div>
          </div>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "gray", wordBreak: "break-all" }}>{model.baseUrl}</div>
          {connectivityMessage ? (
            <div style={{ marginTop: "10px", fontSize: "12px", color: connectivityOk ? "var(--success)" : "var(--error)", wordBreak: "break-all" }}>
              连通性：{connectivityMessage}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-small btn-secondary" onClick={() => void onMove(model.provider, model.id, "up")} disabled={busy || isFirst}>
            <ArrowUp size={14} /> 上移
          </button>
          <button className="btn btn-small btn-secondary" onClick={() => void onMove(model.provider, model.id, "down")} disabled={busy || isLast}>
            <ArrowDown size={14} /> 下移
          </button>
          <button className="btn btn-small btn-secondary" onClick={() => void onTestConnectivity(model)} disabled={busy || connectivityLoading}>
            <PlugZap size={14} /> {connectivityLoading ? "测试中" : "连通性测试"}
          </button>
          <button className="btn btn-small btn-secondary" onClick={() => onEdit(model)} disabled={busy}>
            <Pencil size={14} /> 编辑
          </button>
          {canDelete && (
            <button className="btn btn-small btn-danger" onClick={() => void onDelete(model.provider, model.id)} disabled={busy}>
              <Trash2 size={14} /> 删除
            </button>
          )}
          {!isCurrent && (
            <button className="btn btn-small btn-primary" onClick={() => void onSetDefault(model.id, model.provider)} disabled={busy}>
              设为默认
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
