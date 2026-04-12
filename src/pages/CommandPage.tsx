import { Loader2, Play, Plus, Terminal, Trash2 } from "lucide-react";
import type { CommandResultState, CustomCommandFormState, CustomCommandItem } from "../types/core";

interface CommandPageState {
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  customCommands: CustomCommandItem[];
  cmdResult: CommandResultState | null;
  showAddModal: boolean;
  setShowAddModal: (value: boolean) => void;
  newCmd: CustomCommandFormState;
  setNewCmd: (value: CustomCommandFormState) => void;
  runCommand: (command: string, item?: Pick<CustomCommandItem, "cmd" | "action">) => Promise<void>;
  addCustomCommand: () => void;
  deleteCommand: (cmdToDelete: string) => void;
  commandRunning: boolean;
}

interface CommandPageProps {
  commandState: CommandPageState;
}

const quickCommands: CustomCommandItem[] = [
  { cmd: "openclaw doctor --repair", label: "自动修复", desc: "尝试修复大部分常见问题", builtIn: true },
  { cmd: "openclaw doctor --deep", label: "深度检查", desc: "严格检查，含迁移和旧版兼容", builtIn: true },
  { cmd: "openclaw doctor", label: "常规诊断", desc: "运行默认健康检查", builtIn: true },
  { cmd: "openclaw status", label: "系统状态", desc: "查看当前系统运行状态", builtIn: true },
  { cmd: "openclaw gateway status", label: "Gateway状态", desc: "查看 Gateway 是否在线", builtIn: true },
  { cmd: "openclaw gateway restart", label: "重启Gateway", desc: "重启当前实例的 Gateway 服务", builtIn: true, action: "restartGateway" },
  { cmd: "openclaw sessions", label: "会话列表", desc: "查看当前活跃会话与模型", builtIn: true },
  { cmd: "tmux ls 2>&1 || true", label: "后台任务", desc: "查看所有 tmux 会话", builtIn: true },
];

export function CommandPage({ commandState }: CommandPageProps) {
  const {
    currentInstance,
    customCommands,
    cmdResult,
    showAddModal,
    setShowAddModal,
    newCmd,
    setNewCmd,
    runCommand,
    addCustomCommand,
    deleteCommand,
    commandRunning,
  } = commandState;

  const allCommands = [...quickCommands, ...customCommands.map((command) => ({ ...command, builtIn: false }))];

  return (
    <div className="page-container">
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-header">
          <Terminal size={22} />
          <h2>指令</h2>
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
          当前实例：<strong>{currentInstance?.name || "未选择实例"}</strong>
          <span style={{ color: "var(--text-secondary)" }}>
            {currentInstance ? ` ｜ ${currentInstance.type} ｜ ${currentInstance.baseUrl}` : " ｜ 请先选择要操作的实例"}
          </span>
        </div>

        <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
          点击执行后，下方回馈窗口会显示这次指令返回的输出内容。Doctor 类命令会改为后台投递，并提示到日志页查看结果。
        </p>

        <button className="btn btn-secondary" style={{ marginBottom: "20px" }} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> 添加自定义指令
        </button>

        <div className="quick-commands-grid">
          {allCommands.map((item, idx) => (
            <div key={`${item.cmd}-${idx}`} className="quick-command-item" style={{ position: "relative", opacity: commandRunning ? 0.75 : 1 }}>
              {!item.builtIn && (
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCommand(item.cmd);
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--error)",
                  }}
                  title="删除自定义指令"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <div className="quick-cmd-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{item.label}</span>
                {!item.builtIn && <span style={{ fontSize: 11, color: "gray" }}>自定义</span>}
              </div>
              <div className="quick-cmd-desc">{item.desc}</div>
              <div className="quick-cmd-cmd">{item.cmd}</div>
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-small btn-primary" disabled={commandRunning} onClick={() => runCommand(item.cmd, item)}>
                  {commandRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 执行
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cmd-result" style={{ marginTop: "20px", padding: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px" }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>指令回馈窗口</div>
          {cmdResult ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: "8px", color: cmdResult.success ? "var(--success)" : "var(--error)" }}>
                {cmdResult.success ? "✅" : "❌"} {cmdResult.cmd}
              </div>
              <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "320px", overflow: "auto", background: "var(--bg-hover)", padding: "8px", borderRadius: "4px" }}>
                {cmdResult.output}
                {cmdResult.error && cmdResult.error !== cmdResult.output ? `\n\nError: ${cmdResult.error}` : ""}
              </pre>
            </>
          ) : (
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>点击上方任一指令后，这里会显示 openclaw 返回的输出内容。</div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加自定义指令</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>指令名称 *</label>
                <input type="text" value={newCmd.label} onChange={(e) => setNewCmd({ ...newCmd, label: e.target.value })} placeholder="如：重启服务" />
              </div>
              <div className="form-group">
                <label>命令 *</label>
                <input type="text" value={newCmd.cmd} onChange={(e) => setNewCmd({ ...newCmd, cmd: e.target.value })} placeholder="要执行的命令" />
              </div>
              <div className="form-group">
                <label>描述</label>
                <input type="text" value={newCmd.desc} onChange={(e) => setNewCmd({ ...newCmd, desc: e.target.value })} placeholder="简短描述" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={addCustomCommand}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
