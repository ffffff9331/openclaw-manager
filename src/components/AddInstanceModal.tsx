import { useMemo, useState } from "react";
import type { AppInstance } from "../types/core";
import { validateInstanceBaseUrl } from "../services/instanceService";

interface AddInstanceModalProps {
  open: boolean;
  allowLanAccess: boolean;
  localInstanceStatus: {
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null;
  detectingLocal: boolean;
  onDetectLocal: () => void | Promise<void>;
  onAddDetectedLocal: () => void;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    type: AppInstance["type"];
    baseUrl: string;
    apiBasePath: string;
    healthPath: string;
    notes: string;
  }) => void;
}

interface NewInstanceFormState {
  name: string;
  type: AppInstance["type"];
  baseUrl: string;
  apiBasePath: string;
  healthPath: string;
  notes: string;
}

const defaultFormState: NewInstanceFormState = {
  name: "",
  type: "remote",
  baseUrl: "http://127.0.0.1:18789/",
  apiBasePath: "/",
  healthPath: "/health",
  notes: "",
};

export function AddInstanceModal({
  open,
  allowLanAccess,
  localInstanceStatus,
  detectingLocal,
  onDetectLocal,
  onAddDetectedLocal,
  onClose,
  onSubmit,
}: AddInstanceModalProps) {
  const [form, setForm] = useState<NewInstanceFormState>(defaultFormState);

  const validation = useMemo(() => {
    if (form.type === "local") {
      return { valid: true as const, warning: undefined, reason: undefined };
    }
    return validateInstanceBaseUrl(form.baseUrl, { allowLanAccess });
  }, [allowLanAccess, form.baseUrl, form.type]);

  const reset = () => {
    setForm(defaultFormState);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      alert("请填写实例名称");
      return;
    }

    if (form.type !== "local") {
      if (!validation.valid) {
        alert(validation.reason || "实例地址不合法");
        return;
      }
      if (!form.baseUrl.trim()) {
        alert("请填写实例地址");
        return;
      }
    }

    onSubmit({
      name: trimmedName,
      type: form.type,
      baseUrl: form.type === "local" ? "http://127.0.0.1:18789/" : form.baseUrl.trim(),
      apiBasePath: form.apiBasePath.trim() || "/",
      healthPath: form.healthPath.trim() || "/health",
      notes: form.notes.trim(),
    });
    reset();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新增实例</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        <div className="modal-body">
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              background: "var(--bg-secondary)",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>本机实例检测</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  先探测本机 `127.0.0.1:18789` 是否已有 OpenClaw 在运行，命中后可一键加入。
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => void onDetectLocal()} disabled={detectingLocal}>
                {detectingLocal ? "检测中..." : "检测本机"}
              </button>
            </div>
            {localInstanceStatus ? (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)", display: "grid", gap: 4 }}>
                <div>检测地址：{localInstanceStatus.baseUrl}</div>
                <div>检测结果：{localInstanceStatus.exists && localInstanceStatus.running ? "已发现可用本机实例" : "未发现可用本机实例"}</div>
                {localInstanceStatus.error ? <div>错误信息：{localInstanceStatus.error}</div> : null}
                {localInstanceStatus.exists && localInstanceStatus.running ? (
                  <div style={{ marginTop: 6 }}>
                    <button className="btn btn-primary" onClick={onAddDetectedLocal}>加入本机实例</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="form-group">
            <label>实例名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：办公室 Mac mini"
            />
          </div>
          <div className="form-group">
            <label>实例类型</label>
            <select
              value={form.type}
              onChange={(e) => {
                const nextType = e.target.value as AppInstance["type"];
                const suggestedBaseUrl = nextType === "local"
                  ? "http://127.0.0.1:18789/"
                  : nextType === "docker"
                    ? "http://localhost:18789"
                    : nextType === "nas"
                      ? "http://192.168.1.x:18789"
                      : "http://127.0.0.1:18789/";
                setForm((prev) => ({ ...prev, type: nextType, baseUrl: suggestedBaseUrl }));
              }}
            >
              <option value="local">本机</option>
              <option value="docker">Docker</option>
              <option value="nas">NAS</option>
              <option value="remote">远端</option>
            </select>
          </div>
          <div className="form-group">
            <label>基础地址</label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder={form.type === "docker" ? "http://localhost:18789" : form.type === "nas" ? "http://192.168.1.x:18789" : "http://127.0.0.1:18789/"}
              disabled={form.type === "local"}
            />
            <small>
              {form.type === "local"
                ? "自动使用本机地址 http://127.0.0.1:18789/"
                : form.type === "docker"
                  ? "Docker 容器地址，如 http://localhost:18789 或 http://host.docker.internal:18789"
                  : form.type === "nas"
                    ? "NAS 局域网地址，如 http://192.168.x.x:18789 或 http://nas-name.local:18789"
                    : allowLanAccess
                      ? "仅允许 localhost、127.0.0.1、局域网私有网段地址或 .local 主机名；非本机地址请确认可信。"
                      : "当前已关闭局域网访问，仅允许 localhost 或 127.0.0.1。"}
            </small>
            {form.type !== "local" && !validation.valid && form.baseUrl.trim() ? (
              <small style={{ color: "var(--error)" }}>{validation.reason}</small>
            ) : null}
            {form.type !== "local" && validation.warning ? (
              <small style={{ color: "var(--warning, #d97706)" }}>{validation.warning}</small>
            ) : null}
          </div>
          <div className="form-group">
            <label>接口基础路径</label>
            <input
              value={form.apiBasePath}
              onChange={(e) => setForm((prev) => ({ ...prev, apiBasePath: e.target.value }))}
              placeholder="/"
            />
          </div>
          <div className="form-group">
            <label>健康检查路径</label>
            <input
              value={form.healthPath}
              onChange={(e) => setForm((prev) => ({ ...prev, healthPath: e.target.value }))}
              placeholder="/health"
            />
          </div>
          <div className="form-group">
            <label>备注</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="可选"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>保存并切换</button>
        </div>
      </div>
    </div>
  );
}
