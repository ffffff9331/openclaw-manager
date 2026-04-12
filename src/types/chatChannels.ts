import type {
  Channel,
  DiscordChannelConfig,
  FeishuChannelConfig,
  SignalChannelConfig,
  SlackChannelConfig,
  TelegramChannelConfig,
  WhatsappChannelConfig,
} from "./core";

export interface ChannelConfigBindings {
  telegramConfig: TelegramChannelConfig;
  setTelegramConfig: (value: TelegramChannelConfig) => void;
  feishuConfig: FeishuChannelConfig;
  setFeishuConfig: (value: FeishuChannelConfig) => void;
  discordConfig: DiscordChannelConfig;
  setDiscordConfig: (value: DiscordChannelConfig) => void;
  slackConfig: SlackChannelConfig;
  setSlackConfig: (value: SlackChannelConfig) => void;
  whatsappConfig: WhatsappChannelConfig;
  setWhatsappConfig: (value: WhatsappChannelConfig) => void;
  signalConfig: SignalChannelConfig;
  setSignalConfig: (value: SignalChannelConfig) => void;
}

export interface ChannelConfigSaveActions {
  saveTelegramConfig: () => Promise<void>;
  saveFeishuConfig: () => Promise<void>;
  saveDiscordConfig: () => Promise<void>;
  saveSlackConfig: () => Promise<void>;
  saveWhatsappConfig: () => Promise<void>;
  saveSignalConfig: () => Promise<void>;
}

export interface ChatChannelInteractionProps extends ChannelConfigBindings, ChannelConfigSaveActions {
  channels: Channel[];
  selectedChannel: Channel | null;
  setSelectedChannel: (channel: Channel | null) => void;
  gatewayUrl: string;
  openGatewayChat: () => Promise<void>;
  openChannelChat: (channel: Channel) => Promise<void>;
  toggleChannelEnabled: (channel: Channel) => Promise<void>;
  auditLogs?: import("./core").AuditLogEntry[];
  clearAuditLogs?: () => void;
}
