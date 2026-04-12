import { useCallback, useMemo, useState } from "react";
import { formatActionError } from "../lib/errorMessage";
import { useAppStore } from "../stores/appStore";
import type { ChatChannelInteractionProps } from "../types/chatChannels";
import type {
  AppInstance,
  Channel,
  DiscordChannelConfig,
  FeishuChannelConfig,
  SignalChannelConfig,
  SlackChannelConfig,
  TelegramChannelConfig,
  WhatsappChannelConfig,
} from "../types/core";
import {
  defaultChannels,
  fetchChannelsStatus,
  loadDiscordConfig,
  loadFeishuConfig,
  loadSignalConfig,
  loadSlackConfig,
  loadTelegramConfig,
  loadWhatsappConfig,
  saveDiscordChannelConfig,
  saveFeishuChannelConfig,
  saveSignalChannelConfig,
  saveSlackChannelConfig,
  saveTelegramChannelConfig,
  saveWhatsappChannelConfig,
  toggleChannel,
} from "../services/channelService";
import { applyChannelRuntimeChanges } from "../services/channelRuntimeService";
import { openGatewayDashboard } from "../services/gatewayService";

export interface ChatChannelsState extends ChatChannelInteractionProps {
  loadChannelsStatus: () => Promise<void>;
}

interface UseChatChannelsOptions {
  currentInstance?: AppInstance;
  setSystemLoading: (value: string | null) => void;
}

const CHANNEL_HANDLER_META = {
  telegram: { loadingKey: "saving-telegram", successMessage: "Telegram 配置已保存！" },
  feishu: { loadingKey: "saving-feishu", successMessage: "飞书 配置已保存！" },
  discord: { loadingKey: "saving-discord", successMessage: "Discord 配置已保存！" },
  slack: { loadingKey: "saving-slack", successMessage: "Slack 配置已保存！" },
  whatsapp: { loadingKey: "saving-whatsapp", successMessage: "WhatsApp 配置已保存！" },
  signal: { loadingKey: "saving-signal", successMessage: "Signal 配置已保存！" },
} as const;

const INITIAL_TELEGRAM_CONFIG: TelegramChannelConfig = {
  botToken: "",
  userId: "",
  dmPolicy: "pairing",
  groupPolicy: "open",
};

const INITIAL_FEISHU_CONFIG: FeishuChannelConfig = {
  appId: "",
  appSecret: "",
  verificationToken: "",
};

const INITIAL_DISCORD_CONFIG: DiscordChannelConfig = {
  botToken: "",
  applicationId: "",
};

const INITIAL_SLACK_CONFIG: SlackChannelConfig = {
  botToken: "",
  signingSecret: "",
};

const INITIAL_WHATSAPP_CONFIG: WhatsappChannelConfig = {
  phoneNumberId: "",
  accessToken: "",
};

const INITIAL_SIGNAL_CONFIG: SignalChannelConfig = {
  phoneNumber: "",
  password: "",
};

export function useChatChannels({ currentInstance, setSystemLoading }: UseChatChannelsOptions): ChatChannelsState {
  const recordAudit = useAppStore((state) => state.recordAudit);
  const [channels, setChannels] = useState<Channel[]>(defaultChannels);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [telegramConfig, setTelegramConfig] = useState<TelegramChannelConfig>(INITIAL_TELEGRAM_CONFIG);
  const [feishuConfig, setFeishuConfig] = useState<FeishuChannelConfig>(INITIAL_FEISHU_CONFIG);
  const [discordConfig, setDiscordConfig] = useState<DiscordChannelConfig>(INITIAL_DISCORD_CONFIG);
  const [slackConfig, setSlackConfig] = useState<SlackChannelConfig>(INITIAL_SLACK_CONFIG);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsappChannelConfig>(INITIAL_WHATSAPP_CONFIG);
  const [signalConfig, setSignalConfig] = useState<SignalChannelConfig>(INITIAL_SIGNAL_CONFIG);

  const loadChannelsStatus = useCallback(async () => {
    try {
      const nextChannels = await fetchChannelsStatus(currentInstance, defaultChannels);
      setChannels(nextChannels);
      setSelectedChannel((prev) => {
        if (!prev) return prev;
        return nextChannels.find((channel) => channel.id === prev.id) ?? null;
      });
    } catch (e) {
      console.error("Failed to load channels:", e);
    }
  }, [currentInstance]);

  const openGatewayChat = useCallback(async () => {
    try {
      const url = await openGatewayDashboard(currentInstance);
      setGatewayUrl(url);
      recordAudit({
        action: "打开 Gateway 聊天",
        target: currentInstance?.name || "当前实例",
        result: "已打开",
        detail: url,
      });
    } catch (e) {
      console.error("Failed to open gateway:", e);
      alert(formatActionError("打开 Gateway 失败，请先确认 Gateway 已启动", e));
      recordAudit({
        action: "打开 Gateway 聊天",
        target: currentInstance?.name || "当前实例",
        result: "失败",
        detail: formatActionError("打开 Gateway 失败", e),
      });
    }
  }, [currentInstance, recordAudit]);

  const channelHandlers = useMemo(
    () => ({
      telegram: {
        load: () => loadTelegramConfig(currentInstance).then(setTelegramConfig),
        save: () => saveTelegramChannelConfig(telegramConfig, currentInstance),
        ...CHANNEL_HANDLER_META.telegram,
      },
      feishu: {
        load: () => loadFeishuConfig(currentInstance).then(setFeishuConfig),
        save: () => saveFeishuChannelConfig(feishuConfig, currentInstance),
        ...CHANNEL_HANDLER_META.feishu,
      },
      discord: {
        load: () => loadDiscordConfig(currentInstance).then(setDiscordConfig),
        save: () => saveDiscordChannelConfig(discordConfig, currentInstance),
        ...CHANNEL_HANDLER_META.discord,
      },
      slack: {
        load: () => loadSlackConfig(currentInstance).then(setSlackConfig),
        save: () => saveSlackChannelConfig(slackConfig, currentInstance),
        ...CHANNEL_HANDLER_META.slack,
      },
      whatsapp: {
        load: () => loadWhatsappConfig(currentInstance).then(setWhatsappConfig),
        save: () => saveWhatsappChannelConfig(whatsappConfig, currentInstance),
        ...CHANNEL_HANDLER_META.whatsapp,
      },
      signal: {
        load: () => loadSignalConfig(currentInstance).then(setSignalConfig),
        save: () => saveSignalChannelConfig(signalConfig, currentInstance),
        ...CHANNEL_HANDLER_META.signal,
      },
    }),
    [
      currentInstance,
      telegramConfig,
      feishuConfig,
      discordConfig,
      slackConfig,
      whatsappConfig,
      signalConfig,
    ],
  );

  const loadSelectedChannelConfig = useCallback(
    async (channel: Channel) => {
      const handler = channelHandlers[channel.id as keyof typeof channelHandlers];
      if (!handler) return;
      await handler.load();
    },
    [channelHandlers],
  );

  const openChannelChat = useCallback(
    async (channel: Channel) => {
      setSelectedChannel(channel);
      recordAudit({
        action: "打开渠道配置",
        target: channel.id,
        result: "已打开",
        detail: channel.runtimeSessionKey || channel.name,
      });
      try {
        await loadSelectedChannelConfig(channel);
      } catch (e) {
        console.error(`Failed to load ${channel.id} config:`, e);
      }
    },
    [loadSelectedChannelConfig, recordAudit],
  );

  const syncChannelRuntimeState = useCallback(async () => {
    await applyChannelRuntimeChanges(currentInstance);
    await loadChannelsStatus();
  }, [currentInstance, loadChannelsStatus]);

  const afterSave = useCallback(async () => {
    setSelectedChannel(null);
    await syncChannelRuntimeState();
  }, [syncChannelRuntimeState]);

  const createSaveAction = useCallback(
    async (loadingKey: string, successMessage: string, save: () => Promise<void>) => {
      setSystemLoading(loadingKey);
      try {
        await save();
        const runtimeMessage = await afterSave();
        alert([successMessage, runtimeMessage].filter(Boolean).join("\n"));
        recordAudit({
          action: "保存渠道配置",
          target: loadingKey,
          result: "成功",
          detail: successMessage,
        });
      } catch (e) {
        console.error("Failed to save config:", e);
        const message = formatActionError("保存失败", e);
        alert(message);
        recordAudit({
          action: "保存渠道配置",
          target: loadingKey,
          result: "失败",
          detail: message,
        });
      } finally {
        setSystemLoading(null);
      }
    },
    [afterSave, recordAudit, setSystemLoading],
  );

  const createMappedSaveAction = useCallback(
    (channelId: keyof typeof channelHandlers) => async () => {
      const handler = channelHandlers[channelId];
      await createSaveAction(handler.loadingKey, handler.successMessage, handler.save);
    },
    [channelHandlers, createSaveAction],
  );

  const saveActions = useMemo(
    () => ({
      telegram: createMappedSaveAction("telegram"),
      feishu: createMappedSaveAction("feishu"),
      discord: createMappedSaveAction("discord"),
      slack: createMappedSaveAction("slack"),
      whatsapp: createMappedSaveAction("whatsapp"),
      signal: createMappedSaveAction("signal"),
    }),
    [createMappedSaveAction],
  );

  const toggleChannelEnabled = useCallback(
    async (channel: Channel) => {
      const newEnabled = !channel.enabled;
      setSystemLoading(`toggle-${channel.id}`);
      try {
        await toggleChannel(channel.id, newEnabled, currentInstance);
        await syncChannelRuntimeState();
        recordAudit({
          action: newEnabled ? "启用渠道" : "关闭渠道",
          target: channel.id,
          result: "成功",
          detail: channel.runtimeSessionKey || channel.name,
        });
      } catch (e) {
        console.error("Failed to toggle channel:", e);
        const message = formatActionError("操作失败", e);
        alert(message);
        recordAudit({
          action: newEnabled ? "启用渠道" : "关闭渠道",
          target: channel.id,
          result: "失败",
          detail: message,
        });
      } finally {
        setSystemLoading(null);
      }
    },
    [currentInstance, recordAudit, setSystemLoading, syncChannelRuntimeState],
  );

  return {
    channels,
    selectedChannel,
    setSelectedChannel,
    gatewayUrl,
    telegramConfig,
    setTelegramConfig,
    feishuConfig,
    setFeishuConfig,
    discordConfig,
    setDiscordConfig,
    slackConfig,
    setSlackConfig,
    whatsappConfig,
    setWhatsappConfig,
    signalConfig,
    setSignalConfig,
    loadChannelsStatus,
    openGatewayChat,
    openChannelChat,
    saveTelegramConfig: saveActions.telegram,
    saveFeishuConfig: saveActions.feishu,
    saveDiscordConfig: saveActions.discord,
    saveSlackConfig: saveActions.slack,
    saveWhatsappConfig: saveActions.whatsapp,
    saveSignalConfig: saveActions.signal,
    toggleChannelEnabled,
  } satisfies ChatChannelsState;
}
