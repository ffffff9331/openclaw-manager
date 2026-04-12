import { ModelCard } from "./ModelCard";
import type { ModelConfig } from "../types/core";

interface ModelProviderSectionProps {
  provider: string;
  models: ModelConfig[];
  currentModel: string;
  currentModelProvider: string;
  connectivityResults: Record<string, { ok: boolean; message: string } | undefined>;
  connectivityLoading: boolean;
  busy: boolean;
  onEdit: (model: ModelConfig) => void;
  onDelete: (provider: string, modelId: string) => Promise<void>;
  onSetDefault: (modelId: string, provider: string) => Promise<void>;
  onTestConnectivity: (model: ModelConfig) => Promise<void>;
  onMove: (provider: string, modelId: string, direction: "up" | "down") => Promise<void>;
}

export function ModelProviderSection({
  provider,
  models,
  currentModel,
  currentModelProvider,
  connectivityResults,
  connectivityLoading,
  busy,
  onEdit,
  onDelete,
  onSetDefault,
  onTestConnectivity,
  onMove,
}: ModelProviderSectionProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ padding: "4px 10px", background: "var(--primary)", color: "white", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
          {provider}
        </div>
        <span style={{ color: "gray", fontSize: "13px" }}>{models.length} 个模型</span>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {models.map((model, index) => {
          const connectivity = connectivityResults[`${model.provider}:${model.id}`];
          return (
            <ModelCard
              key={`${model.provider}:${model.id}`}
              model={model}
              isCurrent={model.provider === currentModelProvider && model.id === currentModel}
              isFirst={index === 0}
              isLast={index === models.length - 1}
              connectivityMessage={connectivity?.message}
              connectivityOk={connectivity?.ok}
              connectivityLoading={connectivityLoading}
              busy={busy}
              onEdit={onEdit}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
              onTestConnectivity={onTestConnectivity}
              onMove={onMove}
            />
          );
        })}
      </div>
    </div>
  );
}
