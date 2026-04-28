import type {
  AppInstance,
  Channel,
  CommandResult,
  DiscordChannelConfig,
  FeishuChannelConfig,
  SignalChannelConfig,
  SlackChannelConfig,
  TelegramChannelConfig,
  WhatsappChannelConfig,
} from "../types/core";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";

const NO_INSTANCE_CHANNEL_MESSAGE = "请先选择要操作的实例，频道页不再默认回退到本机 local。";

export const defaultChannels: Channel[] = [
  { id: "telegram", name: "Telegram", icon: "✈️", status: "not_configured", enabled: false, platform: "telegram" },
  { id: "discord", name: "Discord", icon: "🎮", status: "not_configured", enabled: false, platform: "discord" },
  { id: "feishu", name: "飞书", icon: "📨", status: "not_configured", enabled: false, platform: "feishu" },
  { id: "slack", name: "Slack", icon: "💬", status: "not_configured", enabled: false, platform: "slack" },
  { id: "whatsapp", name: "WhatsApp", icon: "📱", status: "not_configured", enabled: false, platform: "whatsapp" },
  { id: "signal", name: "Signal", icon: "🔒", status: "not_configured", enabled: false, platform: "signal" },
];

type ChannelConfigMap = {
  telegram: TelegramChannelConfig;
  feishu: FeishuChannelConfig;
  discord: DiscordChannelConfig;
  slack: SlackChannelConfig;
  whatsapp: WhatsappChannelConfig;
  signal: SignalChannelConfig;
};

type ChannelId = keyof ChannelConfigMap;

type LoadFieldSpec<T> = {
  key: keyof T;
  from?: string;
  fallback?: string;
  masked?: string;
};

type SaveFieldSpec<T> = {
  key: keyof T;
  path?: string;
  masked?: boolean;
};

type ChannelConfigSpec<K extends ChannelId> = {
  fields: Array<LoadFieldSpec<ChannelConfigMap[K]>>;
  saveFields: Array<SaveFieldSpec<ChannelConfigMap[K]>>;
  enableOnSave?: boolean;
};

const OPENCLAW_STATUS_COMMAND = "openclaw status";

const channelConfigSpecs: { [K in ChannelId]: ChannelConfigSpec<K> } = {
  telegram: {
    fields: [
      { key: "botToken", masked: "✅ 已配置" },
      { key: "userId", fallback: "" },
      { key: "dmPolicy", fallback: "pairing" },
      { key: "groupPolicy", fallback: "open" },
    ],
    saveFields: [
      { key: "botToken", masked: true },
      { key: "dmPolicy" },
      { key: "groupPolicy" },
      { key: "userId" },
    ],
  },
  feishu: {
    fields: [
      { key: "appId", fallback: "" },
      { key: "appSecret", masked: "✅ 已配置" },
      { key: "verificationToken", fallback: "" },
    ],
    saveFields: [
      { key: "appId" },
      { key: "appSecret", masked: true },
      { key: "verificationToken" },
    ],
    enableOnSave: true,
  },
  discord: {
    fields: [
      { key: "botToken", masked: "✅ 已配置" },
      { key: "applicationId", fallback: "" },
    ],
    saveFields: [
      { key: "botToken", masked: true },
      { key: "applicationId" },
    ],
    enableOnSave: true,
  },
  slack: {
    fields: [
      { key: "botToken", masked: "***已配置***" },
      { key: "signingSecret", masked: "***已配置***" },
    ],
    saveFields: [
      { key: "botToken", masked: true },
      { key: "signingSecret", masked: true },
    ],
    enableOnSave: true,
  },
  whatsapp: {
    fields: [
      { key: "phoneNumberId", fallback: "" },
      { key: "accessToken", masked: "***已配置***" },
    ],
    saveFields: [
      { key: "phoneNumberId" },
      { key: "accessToken", masked: true },
    ],
    enableOnSave: true,
  },
  signal: {
    fields: [
      { key: "phoneNumber", fallback: "" },
      { key: "password", masked: "***已配置***" },
    ],
    saveFields: [
      { key: "phoneNumber" },
      { key: "password", masked: true },
    ],
    enableOnSave: true,
  },
};

function parseOpenClawJson(output: string): Record<string, unknown> {
  if (!output) return {};
  // 移除警告、装饰字符和 OpenClaw banner
  const lines = output.split('\n');
  const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
  if (jsonStart === -1) return {};
  const jsonLines = lines.slice(jsonStart);
  const cleanOutput = jsonLines.join('\n').trim();
  try {
    return JSON.parse(cleanOutput || "{}");
  } catch (error) {
    console.error("JSON parse error:", error, "raw output:", output);
    return {};
  }
}

function quoteConfigValue(value: string) {
  return `"${value}"`;
}

function getChannelConfigPath(channelId: string, key?: string) {
  return key ? `channels.${channelId}.${key}` : `channels.${channelId}`;
}

function getChannelEnabledPath(channelId: string) {
  return getChannelConfigPath(channelId, "enabled");
}

function isMaskedConfigValue(value: string) {
  return value.includes("已配置");
}

async function readChannelCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  return readFromInstance(instance, command);
}

async function dispatchChannelCommand(instance: AppInstance | undefined, command: string): Promise<CommandResult> {
  return dispatchToInstance(instance, command);
}

async function loadRawChannelConfig(channelId: string, instance?: AppInstance) {
  if (!instance) {
    throw new Error(NO_INSTANCE_CHANNEL_MESSAGE);
  }
  const result = await readChannelCommand(instance, `openclaw config get ${getChannelConfigPath(channelId)}`);
  return result.success ? parseOpenClawJson(result.output) : {};
}

function mapLoadedChannelConfig<K extends ChannelId>(
  config: Record<string, unknown>,
  spec: ChannelConfigSpec<K>,
): ChannelConfigMap[K] {
  const mapped = {} as ChannelConfigMap[K];

  for (const field of spec.fields) {
    const sourceKey = String(field.from ?? field.key);
    const rawValue = config[sourceKey];
    const nextValue = field.masked ? (rawValue ? field.masked : "") : String(rawValue ?? field.fallback ?? "");
    mapped[field.key] = nextValue as ChannelConfigMap[K][typeof field.key];
  }

  return mapped;
}

async function loadMappedChannelConfig<K extends ChannelId>(channelId: K, instance?: AppInstance): Promise<ChannelConfigMap[K]> {
  const config = await loadRawChannelConfig(channelId, instance);
  return mapLoadedChannelConfig(config, channelConfigSpecs[channelId]);
}

async function setConfig(path: string, value: string | boolean, instance?: AppInstance) {
  if (!instance) {
    throw new Error(NO_INSTANCE_CHANNEL_MESSAGE);
  }
  const formatted = typeof value === "boolean" ? String(value) : value;
  await dispatchChannelCommand(instance, `openclaw config set ${path} ${formatted}`);
}

async function saveOptionalStringConfig(
  path: string,
  value: string,
  instance: AppInstance | undefined,
  options?: { masked?: boolean },
) {
  if (!value) return;
  if (options?.masked && isMaskedConfigValue(value)) return;
  await setConfig(path, quoteConfigValue(value), instance);
}

async function saveMappedChannelConfig<K extends ChannelId>(
  channelId: K,
  config: ChannelConfigMap[K],
  instance?: AppInstance,
) {
  const spec = channelConfigSpecs[channelId];

  for (const field of spec.saveFields) {
    const path = field.path ?? getChannelConfigPath(channelId, String(field.key));
    const value = String(config[field.key] ?? "");
    await saveOptionalStringConfig(path, value, instance, { masked: field.masked });
  }

  if (spec.enableOnSave) {
    await setConfig(getChannelEnabledPath(channelId), true, instance);
  }
}

function isConfiguredChannelStatus(line: string) {
  return line.includes("OK") || line.includes("configured");
}

function isEnabledChannelStatus(line: string) {
  return line.includes("ON") || line.includes("enabled");
}

function findChannelStatusLine(channelsOutput: string, channelId: string) {
  return (
    channelsOutput
      .split("\n")
      .find((line) => line.toLowerCase().includes(channelId) && line.startsWith("│")) || ""
  );
}

function mapChannelStatus(channel: Channel, channelsOutput: string): Channel {
  const channelLine = findChannelStatusLine(channelsOutput, channel.id);
  return {
    ...channel,
    status: isConfiguredChannelStatus(channelLine) ? "configured" : "not_configured",
    enabled: isEnabledChannelStatus(channelLine),
  };
}

function extractChannelsOutput(output: string) {
  const lines = output.split("\n");
  const channelsStart = lines.findIndex((line) => line.startsWith("Channels"));
  const channelsEnd = lines.findIndex(
    (line, index) => index > channelsStart && line.startsWith("Sessions"),
  );
  return lines.slice(channelsStart, channelsEnd).join("\n");
}

function extractSessionsOutput(output: string) {
  const lines = output.split("\n");
  const sessionsStart = lines.findIndex((line) => line.startsWith("Sessions"));
  if (sessionsStart < 0) return "";
  return lines.slice(sessionsStart).join("\n");
}

interface RuntimeSessionRow {
  key: string;
  kind: string;
  age: string;
  model: string;
}

function parseSessionRow(line: string): RuntimeSessionRow | null {
  if (!line.startsWith("│")) return null;
  const cells = line
    .split("│")
    .map((part) => part.trim())
    .filter(Boolean);
  if (cells.length < 4) return null;
  const [key, kind, age, model] = cells;
  if (key === "Key" || !key.startsWith("agent:")) return null;
  return { key, kind, age, model };
}

function parseRuntimeSessions(output: string): RuntimeSessionRow[] {
  return output
    .split("\n")
    .map(parseSessionRow)
    .filter((row): row is RuntimeSessionRow => Boolean(row));
}

function findLatestChannelRuntimeSession(channel: Channel, sessions: RuntimeSessionRow[]): RuntimeSessionRow | undefined {
  return sessions.find((session) => session.key.includes(`:${channel.id}:`));
}

function deriveSessionOrigin(channel: Channel, runtime?: RuntimeSessionRow) {
  const sessionKey = runtime?.key ?? "";
  const createdBy = sessionKey.includes(":telegram:")
    ? "telegram"
    : sessionKey.includes(":webchat:")
      ? "webchat"
      : sessionKey.includes(":discord:")
        ? "discord"
        : sessionKey.includes(":cron:")
          ? "cron"
          : channel.id;
  const createdFrom = runtime
    ? (sessionKey.includes(":direct:") ? "channel direct session" : sessionKey.includes(":group:") ? "channel group session" : runtime.kind || "runtime session")
    : "no active runtime session";
  const initialModelHint = runtime?.model || "—";
  return { createdBy, createdFrom, initialModelHint };
}

function attachRuntimeSession(channel: Channel, sessions: RuntimeSessionRow[]): Channel {
  const runtime = findLatestChannelRuntimeSession(channel, sessions);
  const origin = deriveSessionOrigin(channel, runtime);
  if (!runtime) {
    return {
      ...channel,
      ...origin,
    };
  }
  return {
    ...channel,
    runtimeSessionKey: runtime.key,
    runtimeModel: runtime.model,
    runtimeAge: runtime.age,
    runtimeKind: runtime.kind,
    ...origin,
  };
}

export async function fetchChannelsStatus(instance?: AppInstance, baseChannels: Channel[] = defaultChannels): Promise<Channel[]> {
  if (!instance) {
    return baseChannels;
  }

  const result = await readChannelCommand(instance, OPENCLAW_STATUS_COMMAND);
  if (!result.success) return baseChannels;

  const channelsOutput = extractChannelsOutput(result.output);
  const sessionsOutput = extractSessionsOutput(result.output);
  const runtimeSessions = parseRuntimeSessions(sessionsOutput);

  return baseChannels.map((channel) => attachRuntimeSession(mapChannelStatus(channel, channelsOutput), runtimeSessions));
}

export async function loadTelegramConfig(instance?: AppInstance): Promise<TelegramChannelConfig> {
  return loadMappedChannelConfig("telegram", instance);
}

export async function loadFeishuConfig(instance?: AppInstance): Promise<FeishuChannelConfig> {
  return loadMappedChannelConfig("feishu", instance);
}

export async function loadDiscordConfig(instance?: AppInstance): Promise<DiscordChannelConfig> {
  return loadMappedChannelConfig("discord", instance);
}

export async function loadSlackConfig(instance?: AppInstance): Promise<SlackChannelConfig> {
  return loadMappedChannelConfig("slack", instance);
}

export async function loadWhatsappConfig(instance?: AppInstance): Promise<WhatsappChannelConfig> {
  return loadMappedChannelConfig("whatsapp", instance);
}

export async function loadSignalConfig(instance?: AppInstance): Promise<SignalChannelConfig> {
  return loadMappedChannelConfig("signal", instance);
}

export async function saveTelegramChannelConfig(config: TelegramChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("telegram", config, instance);
}

export async function saveFeishuChannelConfig(config: FeishuChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("feishu", config, instance);
}

export async function saveDiscordChannelConfig(config: DiscordChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("discord", config, instance);
}

export async function saveSlackChannelConfig(config: SlackChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("slack", config, instance);
}

export async function saveWhatsappChannelConfig(config: WhatsappChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("whatsapp", config, instance);
}

export async function saveSignalChannelConfig(config: SignalChannelConfig, instance?: AppInstance) {
  await saveMappedChannelConfig("signal", config, instance);
}

export async function toggleChannel(channelId: string, enabled: boolean, instance?: AppInstance) {
  await setConfig(getChannelEnabledPath(channelId), enabled, instance);
}
