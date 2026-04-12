import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatActionError } from "../lib/errorMessage";
import {
  appendCustomCommand,
  loadCustomCommands,
  removeCustomCommand,
  saveCustomCommands,
} from "../services/taskService";
import { executeTaskCommand } from "../services/taskRuntimeService";
import {
  createCronJob,
  editCronJob,
  getCronStatus,
  listCronJobs,
  listCronRuns,
  removeCronJob,
  runCronJobNow as triggerCronJobNow,
  setCronJobEnabled,
} from "../services/cronService";
import type {
  AppInstance,
  CommandResultState,
  CronJob,
  CronJobFormState,
  CronRunEntry,
  CronSchedulerStatus,
  CustomCommandFormState,
  CustomCommandItem,
} from "../types/core";

interface UseTasksStateOptions {
  currentInstance?: AppInstance;
}

const INITIAL_CUSTOM_COMMAND_FORM: CustomCommandFormState = {
  cmd: "",
  label: "",
  desc: "",
};

const INITIAL_CRON_JOB_FORM: CronJobFormState = {
  id: "",
  name: "",
  description: "",
  scheduleKind: "every",
  every: "10m",
  cronExpr: "0 * * * *",
  timezone: "Asia/Shanghai",
  payloadKind: "systemEvent",
  payloadText: "",
  sessionTarget: "main",
  model: "",
  timeoutSeconds: "",
  enabled: true,
};

function mapJobToForm(job?: CronJob): CronJobFormState {
  if (!job) {
    return INITIAL_CRON_JOB_FORM;
  }

  return {
    id: job.id,
    name: job.name || "",
    description: "",
    scheduleKind: job.schedule.kind === "cron" ? "cron" : "every",
    every: job.schedule.everyMs ? `${Math.round(job.schedule.everyMs / 60000)}m` : "10m",
    cronExpr: job.schedule.expr || "0 * * * *",
    timezone: job.schedule.tz || "Asia/Shanghai",
    payloadKind: job.payload.kind === "agentTurn" ? "agentTurn" : "systemEvent",
    payloadText: job.payload.message || job.payload.text || "",
    sessionTarget: job.sessionTarget === "isolated" ? "isolated" : "main",
    model: "",
    timeoutSeconds: job.payload.timeoutSeconds ? String(job.payload.timeoutSeconds) : "",
    enabled: job.enabled,
  };
}

export interface TasksState {
  cmdResult: CommandResultState | null;
  commandRunning: boolean;
  customCommands: ReturnType<typeof loadCustomCommands>;
  cronJobs: CronJob[];
  cronStatus: CronSchedulerStatus | null;
  cronRuns: CronRunEntry[];
  selectedCronJobId: string;
  cronJobForm: CronJobFormState;
  cronLoading: boolean;
  cronError: string;
  cronSubmitting: boolean;
  showAddModal: boolean;
  showCronCreateModal: boolean;
  setShowAddModal: (value: boolean) => void;
  setShowCronCreateModal: (value: boolean) => void;
  setSelectedCronJobId: (value: string) => void;
  newCmd: CustomCommandFormState;
  setNewCmd: (value: CustomCommandFormState) => void;
  setCronJobForm: (value: CronJobFormState) => void;
  startCreateCronJob: () => void;
  startEditCronJob: (jobId: string) => void;
  runCommand: (command: string, item?: Pick<CustomCommandItem, "cmd" | "action">) => Promise<void>;
  addCustomCommand: () => void;
  deleteCommand: (cmdToDelete: string) => void;
  loadCronData: () => Promise<void>;
  loadCronRuns: (jobId: string) => Promise<void>;
  submitCronJob: () => Promise<void>;
  toggleCronJobEnabled: (jobId: string, enabled: boolean) => Promise<void>;
  deleteCronJob: (jobId: string) => Promise<void>;
  runCronJobNow: (jobId: string) => Promise<void>;
}

export function useTasksState({ currentInstance }: UseTasksStateOptions = {}): TasksState {
  const [cmdResult, setCmdResult] = useState<CommandResultState | null>(null);
  const [commandRunning, setCommandRunning] = useState(false);
  const [customCommands, setCustomCommands] = useState(() => loadCustomCommands());
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronStatus, setCronStatus] = useState<CronSchedulerStatus | null>(null);
  const [cronRuns, setCronRuns] = useState<CronRunEntry[]>([]);
  const [selectedCronJobId, setSelectedCronJobId] = useState("");
  const selectedCronJobIdRef = useRef("");
  const [cronLoading, setCronLoading] = useState(false);
  const [cronError, setCronError] = useState("");
  const [cronSubmitting, setCronSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCronCreateModal, setShowCronCreateModal] = useState(false);
  const [newCmd, setNewCmd] = useState<CustomCommandFormState>(INITIAL_CUSTOM_COMMAND_FORM);
  const [cronJobForm, setCronJobForm] = useState<CronJobFormState>(INITIAL_CRON_JOB_FORM);

  const jobMap = useMemo(() => new Map(cronJobs.map((job) => [job.id, job])), [cronJobs]);

  const persistCustomCommands = useCallback((updater: (prev: CustomCommandItem[]) => CustomCommandItem[]) => {
    setCustomCommands((prev) => {
      const next = updater(prev);
      saveCustomCommands(next);
      return next;
    });
  }, []);

  const resetNewCommandForm = useCallback(() => {
    setShowAddModal(false);
    setNewCmd(INITIAL_CUSTOM_COMMAND_FORM);
  }, []);

  const startCreateCronJob = useCallback(() => {
    setCronJobForm(INITIAL_CRON_JOB_FORM);
    setShowCronCreateModal(true);
  }, []);

  const startEditCronJob = useCallback((jobId: string) => {
    const job = jobMap.get(jobId);
    setCronJobForm(mapJobToForm(job));
    setShowCronCreateModal(true);
  }, [jobMap]);

  const closeCronModal = useCallback(() => {
    setShowCronCreateModal(false);
    setCronJobForm(INITIAL_CRON_JOB_FORM);
  }, []);

  const runCommand = useCallback(async (command: string, item?: Pick<CustomCommandItem, "cmd" | "action">) => {
    setCommandRunning(true);
    try {
      const result = await executeTaskCommand(item || { cmd: command }, currentInstance);
      setCmdResult(result);
    } finally {
      setCommandRunning(false);
    }
  }, [currentInstance]);

  useEffect(() => {
    selectedCronJobIdRef.current = selectedCronJobId;
  }, [selectedCronJobId]);

  const loadCronRuns = useCallback(async (jobId: string) => {
    const id = jobId.trim();
    if (!id) {
      setSelectedCronJobId("");
      setCronRuns([]);
      return;
    }
    setCronLoading(true);
    setCronError("");
    try {
      const entries = await listCronRuns(id, currentInstance);
      setSelectedCronJobId(id);
      setCronRuns(entries);
    } catch (error) {
      setCronError(formatActionError("加载运行记录失败", error));
    } finally {
      setCronLoading(false);
    }
  }, [currentInstance]);

  const loadCronData = useCallback(async () => {
    setCronLoading(true);
    setCronError("");
    try {
      const [status, jobs] = await Promise.all([
        getCronStatus(currentInstance),
        listCronJobs(currentInstance),
      ]);
      setCronStatus(status);
      setCronJobs(jobs);
      const currentSelectedId = selectedCronJobIdRef.current;
      const nextSelectedId = currentSelectedId && jobs.some((job) => job.id === currentSelectedId)
        ? currentSelectedId
        : jobs[0]?.id || "";
      setSelectedCronJobId(nextSelectedId);
      setCronRuns([]);
    } catch (error) {
      setCronError(formatActionError("加载定时任务失败", error));
    } finally {
      setCronLoading(false);
    }
  }, [currentInstance]);

  const submitCronJob = useCallback(async () => {
    setCronSubmitting(true);
    setCronError("");
    try {
      if (cronJobForm.id) {
        await editCronJob(cronJobForm.id, cronJobForm, currentInstance);
      } else {
        const created = await createCronJob(cronJobForm, currentInstance);
        if (created.id) {
          setSelectedCronJobId(created.id);
        }
      }
      closeCronModal();
      await loadCronData();
      if (cronJobForm.id) {
        await loadCronRuns(cronJobForm.id);
      }
    } catch (error) {
      setCronError(formatActionError(cronJobForm.id ? "更新任务失败" : "创建任务失败", error));
    } finally {
      setCronSubmitting(false);
    }
  }, [closeCronModal, cronJobForm, currentInstance, loadCronData, loadCronRuns]);

  const toggleCronJobEnabled = useCallback(async (jobId: string, enabled: boolean) => {
    setCronLoading(true);
    setCronError("");
    try {
      await setCronJobEnabled(jobId, enabled, currentInstance);
      await loadCronData();
    } catch (error) {
      setCronError(formatActionError(enabled ? "启用任务失败" : "禁用任务失败", error));
      setCronLoading(false);
    }
  }, [currentInstance, loadCronData]);

  const deleteCronJob = useCallback(async (jobId: string) => {
    setCronLoading(true);
    setCronError("");
    try {
      await removeCronJob(jobId, currentInstance);
      await loadCronData();
    } catch (error) {
      setCronError(formatActionError("删除任务失败", error));
      setCronLoading(false);
    }
  }, [currentInstance, loadCronData]);

  const runCronJobNow = useCallback(async (jobId: string) => {
    setCronLoading(true);
    setCronError("");
    try {
      await triggerCronJobNow(jobId, currentInstance);
      await loadCronData();
      await loadCronRuns(jobId);
    } catch (error) {
      setCronError(formatActionError("立即运行任务失败", error));
      setCronLoading(false);
    }
  }, [currentInstance, loadCronData, loadCronRuns]);

  const addCustomCommand = useCallback(() => {
    let added = false;
    persistCustomCommands((prev) => {
      const next = appendCustomCommand(prev, newCmd);
      added = next !== prev;
      return next;
    });

    if (added) {
      resetNewCommandForm();
    }
  }, [newCmd, persistCustomCommands, resetNewCommandForm]);

  const deleteCommand = useCallback((cmdToDelete: string) => {
    persistCustomCommands((prev) => removeCustomCommand(prev, cmdToDelete));
  }, [persistCustomCommands]);

  return {
    cmdResult,
    commandRunning,
    customCommands,
    cronJobs,
    cronStatus,
    cronRuns,
    selectedCronJobId,
    cronJobForm,
    cronLoading,
    cronError,
    cronSubmitting,
    showAddModal,
    showCronCreateModal,
    setShowAddModal,
    setShowCronCreateModal,
    setSelectedCronJobId,
    newCmd,
    setNewCmd,
    setCronJobForm,
    startCreateCronJob,
    startEditCronJob,
    runCommand,
    addCustomCommand,
    deleteCommand,
    loadCronData,
    loadCronRuns,
    submitCronJob,
    toggleCronJobEnabled,
    deleteCronJob,
    runCronJobNow,
  };
}
