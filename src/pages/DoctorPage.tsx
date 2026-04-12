import { Loader2, Play, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import type { CommandResultState, CustomCommandFormState, CustomCommandItem } from "../types/core";
import type { SystemInfo } from "../services/systemService";

interface DoctorPageState {
  systemInfo: SystemInfo | null;
  doctorResult: string;
  runDoctor?: () => void | Promise<void>;
  refreshDoctorResult?: () => void | Promise<void>;
  checkingUpdate?: boolean;
  updateStatus?: string;
  appVersion?: string;
  managerLatestVersion?: string;
  hasManagerUpdate?: boolean | null;
  runCommand?: (command: string, item?: Pick<CustomCommandItem, "cmd" | "action">) => Promise<void>;
  commandRunning?: boolean;
  cmdResult?: CommandResultState | null;
  customCommands: CustomCommandItem[];
  showAddModal: boolean;
  setShowAddModal: (value: boolean) => void;
  newCmd: CustomCommandFormState;
  setNewCmd: (value: CustomCommandFormState) => void;
  addCustomCommand: () => void;
  deleteCommand: (cmdToDelete: string) => void;
}

interface DoctorPageProps {
  doctorState: DoctorPageState;
}

const cardStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
} as const;

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--text-secondary)", marginBottom: 4, fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600, lineHeight: 1.5, wordBreak: "break-all" }}>{value || "待检测"}</div>
    </div>
  );
}

const doctorQuickCommands: (CustomCommandItem & { group: string })[] = [
  {
    cmd: "openclaw doctor",
    label: "常规诊断",
    desc: "最常用：检查配置、Gateway、Channel 健康，并输出问题与建议。",
    group: "基础诊断",
    builtIn: true,
  },
  {
    cmd: "openclaw doctor --repair",
    label: "自动修复",
    desc: "出问题时优先跑这个，自动尝试修复大部分常见问题。",
    group: "基础诊断",
    builtIn: true,
  },
  {
    cmd: "openclaw doctor --deep",
    label: "深度检查",
    desc: "更严格，包含迁移、旧版兼容等检查。",
    group: "基础诊断",
    builtIn: true,
  },
  {
    cmd: "openclaw doctor --fix",
    label: "修配置字段",
    desc: "只修复配置里的非法或过时字段。",
    group: "基础诊断",
    builtIn: true,
  },
  {
    cmd: "openclaw status",
    label: "系统状态",
    desc: "查看整体状态总览。",
    group: "常用排障",
    builtIn: true,
  },
  {
    cmd: "openclaw gateway status",
    label: "Gateway 状态",
    desc: "查看 Gateway 在线情况、地址和服务状态。",
    group: "常用排障",
    builtIn: true,
  },
  {
    cmd: "openclaw logs --limit 200 --plain",
    label: "最近日志",
    desc: "快速查看最近 200 行日志。",
    group: "常用排障",
    builtIn: true,
  },
  {
    cmd: "openclaw sessions",
    label: "会话列表",
    desc: "查看当前活跃会话。",
    group: "常用排障",
    builtIn: true,
  },
] as const;

const doctorCommandGroups = ["基础诊断", "常用排障"] as const;

function CommandTile({
  item,
  commandRunning,
  onRun,
  onDelete,
}: {
  item: CustomCommandItem & { group?: string };
  commandRunning?: boolean;
  onRun: (item: Pick<CustomCommandItem, "cmd" | "action">) => void;
  onDelete?: (cmd: string) => void;
}) {
  return (
    <div
      className={`channel-card chat-tools-card doctor-command-tile ${item.builtIn ? "configured" : ""}`}
      style={{ textAlign: "left", opacity: commandRunning ? 0.75 : 1, position: "relative", padding: 10, borderRadius: 10 }}
    >
      {!item.builtIn && onDelete ? (
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.cmd);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--error)",
          }}
          title="删除自定义指令"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
      <div className="chat-tools-card-body doctor-command-body" style={{ gap: 8 }}>
        <div className="chat-tools-card-top" style={{ alignItems: "flex-start", gap: 8 }}>
          <div className="channel-card-icon doctor-command-icon" style={{ width: 34, height: 34, minWidth: 34, margin: 0, borderRadius: 8 }}><Wrench size={15} /></div>
          <div className="doctor-command-content" style={{ minWidth: 0, flex: 1 }}>
            <div className="doctor-command-title-row" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-primary)", fontWeight: 600, flexWrap: "wrap" }}>
              <span className="channel-card-name doctor-command-title" style={{ margin: 0, fontSize: 13 }}>{item.label}</span>
              {!item.builtIn ? <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>自定义</span> : null}
            </div>
            <div className="doctor-command-desc" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{item.desc}</div>
            <div className="doctor-command-code" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all", lineHeight: 1.4 }}>{item.cmd}</div>
          </div>
        </div>
        <div className="chat-tools-actions doctor-command-actions">
          <button className="btn btn-secondary btn-small chat-tools-action-btn" onClick={() => onRun(item)} disabled={commandRunning}>
            {commandRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 执行
          </button>
        </div>
      </div>
    </div>
  );
}

export function DoctorPage({ doctorState }: DoctorPageProps) {
  const {
    systemInfo,
    doctorResult,
    runDoctor,
    refreshDoctorResult,
    checkingUpdate,
    updateStatus,
    appVersion,
    managerLatestVersion,
    hasManagerUpdate,
    runCommand,
    commandRunning,
    cmdResult,
    customCommands,
    showAddModal,
    setShowAddModal,
    newCmd,
    setNewCmd,
    addCustomCommand,
    deleteCommand,
  } = doctorState;

  return (
    <div className="page-container">
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <Wrench size={20} />
          <h2>测试诊断</h2>
        </div>
        <div style={{ ...cardStyle, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>系统概览</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-small" onClick={() => refreshDoctorResult?.()} disabled={!refreshDoctorResult || checkingUpdate}>
                <RefreshCw size={14} className={checkingUpdate ? "animate-spin" : ""} /> 刷新结果
              </button>
              <button className="btn btn-primary btn-small" onClick={() => runDoctor?.()} disabled={!runDoctor}>
                <Play size={14} /> 开始诊断
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13 }}>
            <InfoItem
              label="OpenClaw"
              value={systemInfo?.openclawVersion ? `${systemInfo.openclawVersion}${systemInfo.updateAvailable && systemInfo.latestVersion ? `（可更新到 ${systemInfo.latestVersion}）` : ""}` : ""}
            />
            <InfoItem
              label="更新状态"
              value={systemInfo?.updateAvailable ? `有更新：${systemInfo.latestVersion || "检测到新版本"}` : "当前已是最新或暂未检测到更新"}
            />
            <InfoItem
              label="Manager"
              value={appVersion ? `${appVersion}${hasManagerUpdate && managerLatestVersion ? `（可更新到 ${managerLatestVersion}）` : ""}` : systemInfo?.appVersion || ""}
            />
            <InfoItem
              label="Manager 更新"
              value={updateStatus || (hasManagerUpdate === null ? "尚未检查" : hasManagerUpdate ? `有更新：${managerLatestVersion || "检测到新版本"}` : "当前已是最新")}
            />
            <InfoItem label="Node" value={systemInfo?.nodeVersion || ""} />
            <InfoItem label="系统" value={systemInfo?.os || ""} />
            <InfoItem label="配置目录" value={systemInfo?.configPath || ""} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <Wrench size={18} />
          <h2 style={{ fontSize: 16 }}>诊断与排障指令</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> 添加自定义指令
          </button>
        </div>

        <div className="doctor-command-grid">
          {doctorQuickCommands.map((item) => (
            <CommandTile key={item.cmd} item={item} commandRunning={commandRunning} onRun={(command) => void runCommand?.(command.cmd, command)} />
          ))}
          {customCommands.map((item) => (
            <CommandTile key={item.cmd} item={{ ...item, builtIn: false }} commandRunning={commandRunning} onRun={(command) => void runCommand?.(command.cmd, command)} onDelete={deleteCommand} />
          ))}
        </div>

        {!customCommands.length ? (
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 10 }}>还没有自定义指令。</div>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <Wrench size={18} />
          <h2 style={{ fontSize: 16 }}>结果回显</h2>
        </div>
        <div style={{ ...cardStyle, padding: 10 }}>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              maxHeight: 420,
              overflow: "auto",
            }}
          >
            {doctorResult
              ? `诊断结果\n\n${doctorResult}`
              : cmdResult
                ? `${cmdResult.success ? "✅" : "❌"} ${cmdResult.cmd}\n\n${cmdResult.output}${cmdResult.error && cmdResult.error !== cmdResult.output ? `\n\nError: ${cmdResult.error}` : ""}`
                : "还没有输出。点上方“开始诊断”或任一指令后，这里会显示真实返回内容。"}
          </pre>
        </div>
      </div>

      {showAddModal ? (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加自定义指令</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>指令名称 *</label>
                <input type="text" value={newCmd.label} onChange={(e) => setNewCmd({ ...newCmd, label: e.target.value })} placeholder="如：查看最近 gateway 日志" />
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
      ) : null}
    </div>
  );
}
