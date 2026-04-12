interface UninstallConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UninstallConfirmModal({ open, onClose, onConfirm }: UninstallConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ color: "var(--error)" }}>⚠️ 确认卸载</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>确定要卸载 OpenClaw 吗？此操作不可撤销！</p>
          <p>将执行以下操作：</p>
          <ul>
            <li>删除 npm 全局包</li>
            <li>删除配置目录 ~/.openclaw</li>
          </ul>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>确认卸载</button>
        </div>
      </div>
    </div>
  );
}
