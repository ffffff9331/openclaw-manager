export interface CommandResult {
  success: boolean;
  output: string;
  error?: string | null;
}

export interface GatewayStatus {
  running: boolean;
  port?: number;
  uptime?: string;
}

export interface GatewayLaunchAgentHistoryItem {
  at: string;
  action: string;
  state: string;
}

export interface GatewayControlState {
  lastDispatch?: string;
  lastRequest?: string;
  lastResult?: string;
  lastLaunchAgentAction?: string;
  lastLaunchAgentResult?: string;
  lastLaunchAgentState?: string;
  lastLaunchAgentStartedAt?: string;
  lastLaunchAgentFinishedAt?: string;
  lastLaunchAgentDurationSec?: number;
  lastLaunchAgentLog?: string;
  lastLaunchAgentError?: string;
  lastLaunchAgentErrorKind?: string;
  lastLaunchAgentRecoveryHint?: string;
  launchAgentHistory?: GatewayLaunchAgentHistoryItem[];
  launchAgentPlistExists?: boolean;
  launchAgentLoaded?: boolean;
  launchAgentStatus?: string;
}

export type AppInstanceStatus = "online" | "offline" | "unknown";
export type AppInstanceSource = "manual" | "discovered" | "imported";

interface AppInstanceBase {
  id: string;
  name: string;
  status: AppInstanceStatus;
  baseUrl: string;
  apiBasePath: string;
  healthPath: string;
  apiKey?: string;
  isCurrent?: boolean;
  source?: AppInstanceSource;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AppInstanceType = "local" | "docker" | "nas" | "remote";

export interface LocalAppInstance extends AppInstanceBase {
  type: "local";
}

export interface DockerAppInstance extends AppInstanceBase {
  type: "docker";
}

export interface NasAppInstance extends AppInstanceBase {
  type: "nas";
}

export interface RemoteAppInstance extends AppInstanceBase {
  type: "remote";
}

export type AppInstance = LocalAppInstance | DockerAppInstance | NasAppInstance | RemoteAppInstance;

export interface AuditLogEntry {
  id: string;
  at: string;
  action: string;
  target: string;
  result: string;
  detail?: string;
}

export interface Channel {
  id: string;
  name: string;
  icon: string;
  status: "configured" | "not_configured";
  enabled: boolean;
  platform: string;
  runtimeSessionKey?: string;
  runtimeModel?: string;
  runtimeAge?: string;
  runtimeKind?: string;
  createdBy?: string;
  createdFrom?: string;
  initialModelHint?: string;
}

export interface ModelConfig {
  provider: string;
  name: string;
  id: string;
  baseUrl: string;
  apiKey?: string;
  apiKeyRaw?: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface ModelFormState {
  name: string;
  id: string;
  baseUrl: string;
  apiKey: string;
  contextWindow: string;
  maxTokens: string;
}

export interface ModelSwitchFeedback {
  targetLabel: string;
  beforeProvider: string;
  beforeModel: string;
  afterProvider: string;
  afterModel: string;
  effective: boolean;
  message: string;
}

export interface CommandResultState {
  cmd: string;
  output: string;
  success: boolean;
  error?: string;
}

export interface CustomCommandFormState {
  cmd: string;
  label: string;
  desc: string;
}

export type BuiltInTaskAction = "restartGateway";

export interface CustomCommandItem extends CustomCommandFormState {
  builtIn?: boolean;
  action?: BuiltInTaskAction;
}

export interface TelegramChannelConfig {
  botToken: string;
  userId: string;
  dmPolicy: string;
  groupPolicy: string;
}

export interface FeishuChannelConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
}

export interface DiscordChannelConfig {
  botToken: string;
  applicationId: string;
}

export interface SlackChannelConfig {
  botToken: string;
  signingSecret: string;
}

export interface WhatsappChannelConfig {
  phoneNumberId: string;
  accessToken: string;
}

export interface SignalChannelConfig {
  phoneNumber: string;
  password: string;
}

export interface SettingsState {
  whitelistEnabled: boolean;
  fileAccessEnabled: boolean;
}

export interface BackupCreateOptions {
  output?: string;
  verify?: boolean;
  includeWorkspace?: boolean;
  onlyConfig?: boolean;
  dryRun?: boolean;
}

export interface BackupArtifact {
  command: string;
  output: string;
  archivePath?: string;
}

export interface InstallGuideTemplate {
  label: string;
  description?: string;
  content: string;
}

export interface InstallGuide {
  title: string;
  summary: string;
  steps: string[];
  notes?: string[];
  templates?: InstallGuideTemplate[];
}

export interface CronJobSchedule {
  kind: "every" | "cron" | string;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
}

export interface CronJobPayload {
  kind: "systemEvent" | "agentTurn" | string;
  text?: string;
  message?: string;
  timeoutSeconds?: number;
}

export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastStatus?: string;
  lastDurationMs?: number;
  lastDeliveryStatus?: string;
  consecutiveErrors?: number;
  runningAtMs?: number;
  lastError?: string;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  agentId?: string;
  sessionKey?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  schedule: CronJobSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload: CronJobPayload;
  state?: CronJobState;
}

export interface CronSchedulerStatus {
  enabled: boolean;
  storePath?: string;
  jobs?: number;
  nextWakeAtMs?: number;
}

export interface CronRunEntry {
  ts: number;
  jobId: string;
  action: string;
  status?: string;
  summary?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  deliveryStatus?: string;
}

export type CronPayloadKind = "systemEvent" | "agentTurn";
export type CronScheduleKind = "every" | "cron";
export type CronSessionTarget = "main" | "isolated";

export interface CronJobFormState {
  id?: string;
  name: string;
  description: string;
  scheduleKind: CronScheduleKind;
  every: string;
  cronExpr: string;
  timezone: string;
  payloadKind: CronPayloadKind;
  payloadText: string;
  sessionTarget: CronSessionTarget;
  model: string;
  timeoutSeconds: string;
  enabled: boolean;
}
