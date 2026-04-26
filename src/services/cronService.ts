import type {
  AppInstance,
  CronJob,
  CronJobFormState,
  CronRunEntry,
  CronSchedulerStatus,
} from "../types/core";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";

const NO_INSTANCE_CRON_MESSAGE = "请先选择要操作的实例，Cron 页不再默认回退到本机 local。";

function parseJsonOutput<T>(output: string, fallbackMessage: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (error) {
    throw new Error(`${fallbackMessage}：${error}`);
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function buildCronMutationParts(form: CronJobFormState): string[] {
  const parts: string[] = [];
  const name = form.name.trim();
  const description = form.description.trim();
  const payloadText = form.payloadText.trim();
  const timezone = form.timezone.trim();
  const model = form.model.trim();
  const timeoutSeconds = form.timeoutSeconds.trim();

  if (!name) {
    throw new Error("任务名称不能为空");
  }
  if (!payloadText) {
    throw new Error("任务内容不能为空");
  }

  parts.push("--name", shellQuote(name));

  if (description) {
    parts.push("--description", shellQuote(description));
  }

  if (form.scheduleKind === "every") {
    const every = form.every.trim();
    if (!every) {
      throw new Error("循环间隔不能为空");
    }
    parts.push("--every", shellQuote(every));
  } else {
    const cronExpr = form.cronExpr.trim();
    if (!cronExpr) {
      throw new Error("Cron 表达式不能为空");
    }
    parts.push("--cron", shellQuote(cronExpr));
  }

  if (timezone) {
    parts.push("--tz", shellQuote(timezone));
  }

  if (form.payloadKind === "agentTurn") {
    parts.push("--message", shellQuote(payloadText));
  } else {
    parts.push("--system-event", shellQuote(payloadText));
  }

  parts.push("--session", form.sessionTarget === "isolated" ? "isolated" : "main");

  if (model) {
    parts.push("--model", shellQuote(model));
  }

  if (timeoutSeconds) {
    parts.push("--timeout-seconds", shellQuote(timeoutSeconds));
  }

  return parts;
}

function buildCreateCronCommand(form: CronJobFormState): string {
  return [
    "openclaw",
    "cron",
    "add",
    "--json",
    ...buildCronMutationParts(form),
    ...(form.enabled ? [] : ["--disabled"]),
  ].join(" ");
}

function buildEditCronCommand(jobId: string, form: CronJobFormState): string {
  const id = jobId.trim();
  if (!id) {
    throw new Error("任务 ID 不能为空");
  }

  return [
    "openclaw",
    "cron",
    "edit",
    id,
    ...buildCronMutationParts(form),
    ...(form.enabled ? ["--enable"] : ["--disable"]),
  ].join(" ");
}

async function readRequired(instance: AppInstance | undefined, command: string, fallbackMessage: string): Promise<string> {
  if (!instance) {
    throw new Error(NO_INSTANCE_CRON_MESSAGE);
  }
  const result = await readFromInstance(instance, command);
  if (!result.success) {
    throw new Error(result.error || result.output || fallbackMessage);
  }
  return result.output || "";
}

async function dispatchRequired(instance: AppInstance | undefined, command: string, fallbackMessage: string): Promise<string> {
  if (!instance) {
    throw new Error(NO_INSTANCE_CRON_MESSAGE);
  }
  const result = await dispatchToInstance(instance, command);
  if (!result.success) {
    throw new Error(result.error || result.output || fallbackMessage);
  }
  return result.output || "";
}

export async function getCronStatus(instance?: AppInstance): Promise<CronSchedulerStatus> {
  const output = await readRequired(instance, "openclaw cron status --json", "读取定时任务调度器状态失败");
  return parseJsonOutput<CronSchedulerStatus>(output, "解析定时任务调度器状态失败");
}

export async function listCronJobs(instance?: AppInstance): Promise<CronJob[]> {
  const output = await readRequired(instance, "openclaw cron list --all --json", "读取定时任务列表失败");
  const result = parseJsonOutput<{ jobs?: CronJob[] }>(output, "解析定时任务列表失败");
  return Array.isArray(result.jobs) ? result.jobs : [];
}

export async function listCronRuns(jobId: string, instance?: AppInstance): Promise<CronRunEntry[]> {
  const id = jobId.trim();
  if (!id) {
    throw new Error("任务 ID 不能为空");
  }
  const output = await readRequired(instance, `openclaw cron runs --id ${id} --limit 20`, "读取定时任务运行记录失败");
  const result = parseJsonOutput<{ entries?: CronRunEntry[] }>(output, "解析定时任务运行记录失败");
  return Array.isArray(result.entries) ? result.entries : [];
}

export async function createCronJob(form: CronJobFormState, instance?: AppInstance): Promise<CronJob> {
  const output = await dispatchRequired(instance, buildCreateCronCommand(form), "创建定时任务失败");
  return parseJsonOutput<CronJob>(output, "解析新建定时任务结果失败");
}

export async function editCronJob(jobId: string, form: CronJobFormState, instance?: AppInstance): Promise<void> {
  await dispatchRequired(instance, buildEditCronCommand(jobId, form), "编辑定时任务失败");
}

export async function setCronJobEnabled(jobId: string, enabled: boolean, instance?: AppInstance): Promise<void> {
  const id = jobId.trim();
  if (!id) {
    throw new Error("任务 ID 不能为空");
  }
  const command = enabled ? `openclaw cron enable ${id}` : `openclaw cron disable ${id}`;
  await dispatchRequired(instance, command, enabled ? "启用定时任务失败" : "禁用定时任务失败");
}

export async function removeCronJob(jobId: string, instance?: AppInstance): Promise<void> {
  const id = jobId.trim();
  if (!id) {
    throw new Error("任务 ID 不能为空");
  }
  await dispatchRequired(instance, `openclaw cron rm ${id}`, "删除定时任务失败");
}

export async function runCronJobNow(jobId: string, instance?: AppInstance): Promise<void> {
  const id = jobId.trim();
  if (!id) {
    throw new Error("任务 ID 不能为空");
  }
  await dispatchRequired(instance, `openclaw cron run ${id}`, "立即运行定时任务失败");
}
