import { useMemo } from "react";
import { ExternalLink, Loader2, Power, Settings2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChannelConfigModal } from "../components/ChannelConfigModal";
import type { ChatChannelInteractionProps } from "../types/chatChannels";

interface ChatPageProps extends ChatChannelInteractionProps {
  systemLoading: string | null;
}

const channelLinks: Record<string, string> = {
  telegram: "https://web.telegram.org/",
  discord: "https://discord.com/channels/@me",
  feishu: "https://app.feishu.cn/",
  slack: "https://app.slack.com/client",
  whatsapp: "https://web.whatsapp.com/",
  signal: "https://signal.org/download/",
};

const CARD_STYLE = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
} as const;

export function ChatPage(props: ChatPageProps) {
  const openChannelWeb = async (url?: string) => {
    if (!url) return;
    try {
      await openUrl(url);
    } catch {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  const filteredChannels = useMemo(() => props.channels, [props.channels]);

  return (
    <div className="page-container">
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="chat-tools-stack">
          <button type="button" className="gateway-entry-bar chat-tools-gateway-entry" onClick={props.openGatewayChat}>
            <div className="gateway-entry-main">
              <div className="gateway-entry-title">Gateway</div>
              <div className="gateway-entry-desc">打开 Gateway 聊天界面</div>
            </div>
            <div className="gateway-entry-url">{props.gatewayUrl || "http://127.0.0.1:18789/"}</div>
          </button>

        </div>
      </div>

      <div className="channel-grid chat-tools-grid">
        {filteredChannels.map((channel) => {
          const toggleLoading = props.systemLoading === `toggle-${channel.id}`;
          const docsUrl = channelLinks[channel.id];
          return (
            <div
              key={channel.id}
              className={`channel-card chat-tools-card ${channel.status === "configured" ? "configured" : ""}`}
              style={{ textAlign: "left", cursor: docsUrl ? "pointer" : "default" }}
              onClick={() => void openChannelWeb(docsUrl)}
              role={docsUrl ? "button" : undefined}
              tabIndex={docsUrl ? 0 : undefined}
              onKeyDown={(e) => {
                if (!docsUrl) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openChannelWeb(docsUrl);
                }
              }}
            >
              <div className="chat-tools-card-body">
                <div className="chat-tools-card-top">
                  <div className="channel-card-icon">{channel.icon}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-primary)", fontWeight: 600 }}>
                      <span className="channel-card-name" style={{ margin: 0 }}>{channel.name}</span>
                      {docsUrl ? <ExternalLink size={14} /> : null}
                    </div>
                  </div>
                </div>
                <div className="chat-tools-actions">
                  <button className="btn btn-secondary btn-small chat-tools-action-btn" onClick={(e) => {
                    e.stopPropagation();
                    void props.openChannelChat(channel);
                  }}>
                    <Settings2 size={14} /> 配置
                  </button>
                  <button className={channel.enabled ? "btn btn-primary btn-small chat-tools-action-btn" : "btn btn-secondary btn-small chat-tools-action-btn"} onClick={(e) => {
                    e.stopPropagation();
                    void props.toggleChannelEnabled(channel);
                  }} disabled={toggleLoading}>
                    {toggleLoading ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                    {channel.enabled ? "已开" : "开关"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ChannelConfigModal
        selectedChannel={props.selectedChannel}
        systemLoading={props.systemLoading}
        onClose={() => props.setSelectedChannel(null)}
        telegramConfig={props.telegramConfig}
        setTelegramConfig={props.setTelegramConfig}
        feishuConfig={props.feishuConfig}
        setFeishuConfig={props.setFeishuConfig}
        discordConfig={props.discordConfig}
        setDiscordConfig={props.setDiscordConfig}
        slackConfig={props.slackConfig}
        setSlackConfig={props.setSlackConfig}
        whatsappConfig={props.whatsappConfig}
        setWhatsappConfig={props.setWhatsappConfig}
        signalConfig={props.signalConfig}
        setSignalConfig={props.setSignalConfig}
        saveTelegramConfig={props.saveTelegramConfig}
        saveFeishuConfig={props.saveFeishuConfig}
        saveDiscordConfig={props.saveDiscordConfig}
        saveSlackConfig={props.saveSlackConfig}
        saveWhatsappConfig={props.saveWhatsappConfig}
        saveSignalConfig={props.saveSignalConfig}
      />
    </div>
  );
}
