import { memo } from "react";
import { Clock3, History, Loader2, Pause, Pencil, Play, Plus, RefreshCcw, Trash2 } from "lucide-react";
import type {
  CronJob,
  CronJobFormState,
  CronRunEntry,
  CronSchedulerStatus,
} from "../types/core";

interface TasksPageState {
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  cronJobs: CronJob[];
  cronStatus: CronSchedulerStatus | null;
  cronRuns: CronRunEntry[];
  selectedCronJobId: string;
  cronJobForm: CronJobFormState;
  cronLoading: boolean;
  cronError: string;
  cronSubmitting: boolean;
  showCronCreateModal: boolean;
  setShowCronCreateModal: (value: boolean) => void;
  setSelectedCronJobId: (value: string) => void;
  setCronJobForm: (value: CronJobFormState) => void;
  startCreateCronJob: () => void;
  startEditCronJob: (jobId: string) => void;
  loadCronData: () => Promise<void>;
  loadCronRuns: (jobId: string) => Promise<void>;
  submitCronJob: () => Promise<void>;
  toggleCronJobEnabled: (jobId: string, enabled: boolean) => Promise<void>;
  deleteCronJob: (jobId: string) => Promise<void>;
  runCronJobNow: (jobId: string) => Promise<void>;
}

interface TasksPageProps {
  tasksState: TasksPageState;
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(timestamp);
  }
}

function formatDuration(durationMs?: number) {
  if (!durationMs) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatSchedule(job: CronJob) {
  if (job.schedule.kind === "every" && job.schedule.everyMs) {
    const minutes = Math.round(job.schedule.everyMs / 60000);
    if (minutes >= 60 && minutes % 60 === 0) {
      return `每 ${minutes / 60} 小时`;
    }
    return `每 ${minutes} 分钟`;
  }

  if (job.schedule.kind === "cron" && job.schedule.expr) {
    return `${job.schedule.expr}${job.schedule.tz ? ` (${job.schedule.tz})` : ""}`;
  }

  return job.schedule.kind || "未知";
}

const CronJobsSection = memo(function CronJobsSection({
  cronJobs,
  cronLoading,
  setSelectedCronJobId,
  loadCronRuns,
  startEditCronJob,
  runCronJobNow,
  toggleCronJobEnabled,
  deleteCronJob,
}: {
  cronJobs: CronJob[];
  cronLoading: boolean;
  setSelectedCronJobId: (value: string) => void;
  loadCronRuns: (jobId: string) => Promise<void>;
  startEditCronJob: (jobId: string) => void;
  runCronJobNow: (jobId: string) => Promise<void>;
  toggleCronJobEnabled: (jobId: string, enabled: boolean) => Promise<void>;
  deleteCronJob: (jobId: string) => Promise<void>;
}) {
  return (
    <div className="quick-commands-grid" style={{ marginBottom: 20 }}>
      {cronJobs.map((job) => (
        <div key={job.id} className="quick-command-item" style={{ position: "relative", opacity: cronLoading ? 0.8 : 1 }}>
          <div className="quick-cmd-label" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{job.name || job.id}</span>
            <span style={{ fontSize: 11, color: job.enabled ? "var(--success)" : "var(--text-secondary)" }}>
              {job.enabled ? "启用中" : "已禁用"}
            </span>
          </div>
          <div className="quick-cmd-desc">{formatSchedule(job)}</div>
          <div className="quick-cmd-cmd">{job.payload.text || job.payload.message || job.payload.kind}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10 }}>
            <div>下次运行：{formatDateTime(job.state?.nextRunAtMs)}</div>
            <div>最近状态：{job.state?.lastStatus || "—"}</div>
            <div>连续错误：{job.state?.consecutiveErrors ?? 0}</div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-small btn-secondary"
                disabled={cronLoading}
                onClick={() => {
                  setSelectedCronJobId(job.id);
                  void loadCronRuns(job.id);
                }}
              >
                <History size={14} /> 运行记录
              </button>
              <button className="btn btn-small btn-secondary" disabled={cronLoading} onClick={() => startEditCronJob(job.id)}>
                <Pencil size={14} /> 编辑
              </button>
              <button className="btn btn-small btn-secondary" disabled={cronLoading} onClick={() => void runCronJobNow(job.id)}>
                <Play size={14} /> 立即运行
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-small btn-secondary" disabled={cronLoading} onClick={() => void toggleCronJobEnabled(job.id, !job.enabled)}>
                <Pause size={14} /> {job.enabled ? "禁用" : "启用"}
              </button>
              <button className="btn btn-small btn-danger" disabled={cronLoading} onClick={() => void deleteCronJob(job.id)}>
                <Trash2 size={14} /> 删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

const CronRunsSection = memo(function CronRunsSection({ selectedCronJobId, cronRuns }: { selectedCronJobId: string; cronRuns: CronRunEntry[] }) {
  return (
    <div className="card" style={{ background: "var(--bg-secondary)" }}>
      <div className="card-header">
        <History size={20} />
        <h3 style={{ margin: 0 }}>最近运行记录</h3>
      </div>
      <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
        当前查看任务：{selectedCronJobId || "未选择"}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {cronRuns.length === 0 ? (
          <div style={{ color: "var(--text-secondary)" }}>暂无运行记录</div>
        ) : (
          cronRuns.map((entry) => (
            <div key={`${entry.jobId}-${entry.ts}`} className="quick-command-item">
              <div className="quick-cmd-label" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{entry.status || entry.action}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDateTime(entry.ts)}</span>
              </div>
              <div className="quick-cmd-desc">{entry.summary || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                <div>运行时间：{formatDateTime(entry.runAtMs)}</div>
                <div>耗时：{formatDuration(entry.durationMs)}</div>
                <div>下次运行：{formatDateTime(entry.nextRunAtMs)}</div>
                <div>投递状态：{entry.deliveryStatus || "—"}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

const CronJobModal = memo(function CronJobModal({
  show,
  isEditingCronJob,
  cronJobForm,
  setCronJobForm,
  setShowCronCreateModal,
  submitCronJob,
  cronSubmitting,
}: {
  show: boolean;
  isEditingCronJob: boolean;
  cronJobForm: CronJobFormState;
  setCronJobForm: (value: CronJobFormState) => void;
  setShowCronCreateModal: (value: boolean) => void;
  submitCronJob: () => Promise<void>;
  cronSubmitting: boolean;
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowCronCreateModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditingCronJob ? "编辑定时任务" : "新建定时任务"}</h2>
          <button className="modal-close" onClick={() => setShowCronCreateModal(false)}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>任务名称 *</label>
            <input type="text" value={cronJobForm.name} onChange={(e) => setCronJobForm({ ...cronJobForm, name: e.target.value })} placeholder="如：每小时健康检查" />
          </div>
          <div className="form-group">
            <label>描述</label>
            <input type="text" value={cronJobForm.description} onChange={(e) => setCronJobForm({ ...cronJobForm, description: e.target.value })} placeholder="可选描述" />
          </div>
          <div className="form-group">
            <label>调度方式</label>
            <select value={cronJobForm.scheduleKind} onChange={(e) => setCronJobForm({ ...cronJobForm, scheduleKind: e.target.value as CronJobFormState["scheduleKind"] })}>
              <option value="every">按间隔</option>
              <option value="cron">按 Cron 表达式</option>
            </select>
          </div>
          {cronJobForm.scheduleKind === "every" ? (
            <div className="form-group">
              <label>循环间隔 *</label>
              <input type="text" value={cronJobForm.every} onChange={(e) => setCronJobForm({ ...cronJobForm, every: e.target.value })} placeholder="如：10m / 1h" />
            </div>
          ) : (
            <div className="form-group">
              <label>Cron 表达式 *</label>
              <input type="text" value={cronJobForm.cronExpr} onChange={(e) => setCronJobForm({ ...cronJobForm, cronExpr: e.target.value })} placeholder="如：0 * * * *" />
            </div>
          )}
          <div className="form-group">
            <label>时区</label>
            <input type="text" value={cronJobForm.timezone} onChange={(e) => setCronJobForm({ ...cronJobForm, timezone: e.target.value })} placeholder="Asia/Shanghai" />
          </div>
          <div className="form-group">
            <label>任务类型</label>
            <select value={cronJobForm.payloadKind} onChange={(e) => setCronJobForm({ ...cronJobForm, payloadKind: e.target.value as CronJobFormState["payloadKind"] })}>
              <option value="systemEvent">系统事件</option>
              <option value="agentTurn">Agent 消息</option>
            </select>
          </div>
          <div className="form-group">
            <label>任务内容 *</label>
            <textarea value={cronJobForm.payloadText} onChange={(e) => setCronJobForm({ ...cronJobForm, payloadText: e.target.value })} placeholder="systemEvent 文本或 agentTurn 消息" rows={4} />
          </div>
          <div className="form-group">
            <label>会话目标</label>
            <select value={cronJobForm.sessionTarget} onChange={(e) => setCronJobForm({ ...cronJobForm, sessionTarget: e.target.value as CronJobFormState["sessionTarget"] })}>
              <option value="main">main</option>
              <option value="isolated">isolated</option>
            </select>
          </div>
          <div className="form-group">
            <label>模型覆盖（可选）</label>
            <input type="text" value={cronJobForm.model} onChange={(e) => setCronJobForm({ ...cronJobForm, model: e.target.value })} placeholder="provider/model 或 alias" />
          </div>
          <div className="form-group">
            <label>超时秒数（可选）</label>
            <input type="text" value={cronJobForm.timeoutSeconds} onChange={(e) => setCronJobForm({ ...cronJobForm, timeoutSeconds: e.target.value })} placeholder="如：120" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={cronJobForm.enabled} onChange={(e) => setCronJobForm({ ...cronJobForm, enabled: e.target.checked })} />
            保存后启用
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowCronCreateModal(false)}>取消</button>
          <button className="btn btn-primary" onClick={() => void submitCronJob()} disabled={cronSubmitting}>
            {cronSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {isEditingCronJob ? "保存" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
});

export function TasksPage({ tasksState }: TasksPageProps) {
  const {
    currentInstance,
    cronJobs,
    cronStatus,
    cronRuns,
    selectedCronJobId,
    cronJobForm,
    cronLoading,
    cronError,
    cronSubmitting,
    showCronCreateModal,
    setShowCronCreateModal,
    setSelectedCronJobId,
    setCronJobForm,
    startCreateCronJob,
    startEditCronJob,
    loadCronData,
    loadCronRuns,
    submitCronJob,
    toggleCronJobEnabled,
    deleteCronJob,
    runCronJobNow,
  } = tasksState;

  const isEditingCronJob = Boolean(cronJobForm.id);

  return (
    <div className="page-container">
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-header">
          <Clock3 size={22} />
          <h2>定时任务</h2>
        </div>

        <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>
          当前实例下已经支持查看调度器状态、任务列表、创建任务、编辑任务、启用/禁用、立即运行、删除，以及最近运行记录。
        </p>
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
        </div>
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          当前批次暂不覆盖高级编排字段：`announce`、`delivery`、`account`、`failure-alert`、`session-key`、`light-context`。
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="quick-command-item" style={{ minWidth: 180 }}>
            <div className="quick-cmd-label">调度器</div>
            <div className="quick-cmd-desc">{cronStatus?.enabled ? "已启用" : "未启用 / 未读取"}</div>
          </div>
          <div className="quick-command-item" style={{ minWidth: 180 }}>
            <div className="quick-cmd-label">任务数</div>
            <div className="quick-cmd-desc">{cronStatus?.jobs ?? cronJobs.length}</div>
          </div>
          <div className="quick-command-item" style={{ minWidth: 240 }}>
            <div className="quick-cmd-label">下次唤醒</div>
            <div className="quick-cmd-desc">{formatDateTime(cronStatus?.nextWakeAtMs)}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={startCreateCronJob}>
              <Plus size={16} /> 新建任务
            </button>
            <button className="btn btn-secondary" onClick={() => void loadCronData()} disabled={cronLoading}>
              {cronLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} 刷新任务
            </button>
          </div>
        </div>

        {cronError && (
          <div className="cmd-result" style={{ marginBottom: 16, borderColor: "var(--error)" }}>
            <div style={{ color: "var(--error)", fontWeight: 600, marginBottom: 6 }}>定时任务操作失败</div>
            <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{cronError}</pre>
          </div>
        )}

        <CronJobsSection
          cronJobs={cronJobs}
          cronLoading={cronLoading}
          setSelectedCronJobId={setSelectedCronJobId}
          loadCronRuns={loadCronRuns}
          startEditCronJob={startEditCronJob}
          runCronJobNow={runCronJobNow}
          toggleCronJobEnabled={toggleCronJobEnabled}
          deleteCronJob={deleteCronJob}
        />

        <CronRunsSection selectedCronJobId={selectedCronJobId} cronRuns={cronRuns} />
      </div>

      <CronJobModal
        show={showCronCreateModal}
        isEditingCronJob={isEditingCronJob}
        cronJobForm={cronJobForm}
        setCronJobForm={setCronJobForm}
        setShowCronCreateModal={setShowCronCreateModal}
        submitCronJob={submitCronJob}
        cronSubmitting={cronSubmitting}
      />
    </div>
  );
}
