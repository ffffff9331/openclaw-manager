import type { ModelFormState } from "../types/core";

interface ModelFormModalProps {
  title: string;
  form: ModelFormState;
  setForm: (value: ModelFormState) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  error?: string;
  apiKeyPlaceholder?: string;
}

export function ModelFormModal({
  title,
  form,
  setForm,
  onClose,
  onSubmit,
  submitLabel,
  error,
  apiKeyPlaceholder = "API Key",
}: ModelFormModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error ? (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--error)",
                background: "var(--bg-secondary)",
                color: "var(--error)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {error}
            </div>
          ) : null}
          <div className="form-group">
            <label>模型名称 *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：GPT-4o" />
          </div>
          <div className="form-group">
            <label>模型 ID *</label>
            <input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="如：gpt-4o" />
          </div>
          <div className="form-group">
            <label>Base URL *</label>
            <input type="text" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="如：https://api.openai.com/v1" />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={apiKeyPlaceholder} />
          </div>
          <div className="form-group">
            <label>上下文窗口</label>
            <input type="text" value={form.contextWindow} onChange={(e) => setForm({ ...form, contextWindow: e.target.value })} placeholder="如：128000" />
          </div>
          <div className="form-group">
            <label>最大输出</label>
            <input type="text" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} placeholder="如：8192" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => void onSubmit()}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
