import { Loader2 } from "lucide-react";
import type { Channel } from "../types/core";
import type { ChannelConfigBindings, ChannelConfigSaveActions } from "../types/chatChannels";

interface ChannelConfigModalProps extends ChannelConfigBindings, ChannelConfigSaveActions {
  selectedChannel: Channel | null;
  systemLoading: string | null;
  onClose: () => void;
}

export function ChannelConfigModal({
  selectedChannel,
  systemLoading,
  onClose,
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
  saveTelegramConfig,
  saveFeishuConfig,
  saveDiscordConfig,
  saveSlackConfig,
  saveWhatsappConfig,
  saveSignalConfig,
}: ChannelConfigModalProps) {
  if (!selectedChannel) return null;

  const saveButton = (loadingKey: string, onSave: () => Promise<void>, label = "保存配置") => (
    <button className="btn btn-primary" onClick={onSave} disabled={systemLoading === loadingKey}>
      {systemLoading === loadingKey ? <Loader2 size={16} className="animate-spin" /> : null}
      {label}
    </button>
  );

  const renderConfig = () => {
    if (selectedChannel.id === "telegram") {
      return (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input type="password" value={telegramConfig.botToken} onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })} placeholder="Telegram Bot Token" />
          </div>
          <div className="form-group">
            <label>User ID</label>
            <input type="text" value={telegramConfig.userId} onChange={(e) => setTelegramConfig({ ...telegramConfig, userId: e.target.value })} placeholder="Telegram 用户 ID" />
          </div>
          <div className="form-group">
            <label>DM Policy</label>
            <select value={telegramConfig.dmPolicy} onChange={(e) => setTelegramConfig({ ...telegramConfig, dmPolicy: e.target.value })}>
              <option value="pairing">pairing</option>
              <option value="open">open</option>
              <option value="off">off</option>
            </select>
          </div>
          <div className="form-group">
            <label>Group Policy</label>
            <select value={telegramConfig.groupPolicy} onChange={(e) => setTelegramConfig({ ...telegramConfig, groupPolicy: e.target.value })}>
              <option value="open">open</option>
              <option value="mention">mention</option>
              <option value="off">off</option>
            </select>
          </div>
          {saveButton("saving-telegram", saveTelegramConfig)}
        </>
      );
    }

    if (selectedChannel.id === "feishu") {
      return (
        <>
          <div className="form-group">
            <label>App ID</label>
            <input type="text" value={feishuConfig.appId} onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })} />
          </div>
          <div className="form-group">
            <label>App Secret</label>
            <input type="password" value={feishuConfig.appSecret} onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Verification Token</label>
            <input type="text" value={feishuConfig.verificationToken} onChange={(e) => setFeishuConfig({ ...feishuConfig, verificationToken: e.target.value })} />
          </div>
          {saveButton("saving-feishu", saveFeishuConfig)}
        </>
      );
    }

    if (selectedChannel.id === "discord") {
      return (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input type="password" value={discordConfig.botToken} onChange={(e) => setDiscordConfig({ ...discordConfig, botToken: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Application ID</label>
            <input type="text" value={discordConfig.applicationId} onChange={(e) => setDiscordConfig({ ...discordConfig, applicationId: e.target.value })} />
          </div>
          {saveButton("saving-discord", saveDiscordConfig)}
        </>
      );
    }

    if (selectedChannel.id === "slack") {
      return (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input type="password" value={slackConfig.botToken} onChange={(e) => setSlackConfig({ ...slackConfig, botToken: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Signing Secret</label>
            <input type="password" value={slackConfig.signingSecret} onChange={(e) => setSlackConfig({ ...slackConfig, signingSecret: e.target.value })} />
          </div>
          {saveButton("saving-slack", saveSlackConfig)}
        </>
      );
    }

    if (selectedChannel.id === "whatsapp") {
      return (
        <>
          <div className="form-group">
            <label>Phone Number ID</label>
            <input type="text" value={whatsappConfig.phoneNumberId} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Access Token</label>
            <input type="password" value={whatsappConfig.accessToken} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })} />
          </div>
          {saveButton("saving-whatsapp", saveWhatsappConfig)}
        </>
      );
    }

    if (selectedChannel.id === "signal") {
      return (
        <>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="text" value={signalConfig.phoneNumber} onChange={(e) => setSignalConfig({ ...signalConfig, phoneNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={signalConfig.password} onChange={(e) => setSignalConfig({ ...signalConfig, password: e.target.value })} />
          </div>
          {saveButton("saving-signal", saveSignalConfig)}
        </>
      );
    }

    return <div style={{ color: "gray" }}>暂未支持该渠道配置表单。</div>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{selectedChannel.name} 配置</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{renderConfig()}</div>
      </div>
    </div>
  );
}
