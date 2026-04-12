import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { DatabaseBackup, FolderOpen, Moon, Radar, Settings, Shield, Sun } from "lucide-react";
import { UninstallConfirmModal } from "../components/UninstallConfirmModal";
import { getInstanceCapabilitySummary, getInstanceTypeLabel, supportsDirectUninstall, supportsHostFileOps } from "../lib/instanceCapabilities";
import type { BackupCreateOptions, GatewayControlState, SettingsState } from "../types/core";
import type { LanDiscoveryCandidate } from "../services/lanDiscoveryService";

interface SettingsPageState {
  settings: SettingsState;
  currentInstance?: {
    name: string;
    type: import("../types/core").AppInstance["type"];
    baseUrl: string;
  };
  appSettings: {
    allowLanAccess: boolean;
    mdnsEnabled: boolean;
  };
  updateStatus: string;
  appVersion: string;
  hasManagerUpdate: boolean | null;
  configPath: string;
  dataPath: string;
  checkingUpdate: boolean;
  showUninstallConfirm: boolean;
  setShowUninstallConfirm: (value: boolean) => void;
  gatewayControlState: GatewayControlState;
  systemLoading: string | null;
  backupStatus: string;
  backupCommandOutput: string;
  backupArchivePath: string;
  backupOptions: BackupCreateOptions;
  setBackupOptions: (value: BackupCreateOptions | ((prev: BackupCreateOptions) => BackupCreateOptions)) => void;
  checkForUpdates: () => Promise<void>;
  openDownloadUrl: () => Promise<void>;
  uninstallOpenClaw: () => void;
  openConfigDir: () => void;
  previewBackupPlan: () => Promise<void>;
  createBackupNow: () => Promise<void>;
  verifyBackupNow: (archivePath?: string) => Promise<void>;
  restoreBackupNow: (archivePath?: string) => Promise<void>;
  onToggleWhitelist: () => void;
  onToggleFileAccess: () => void;
  onToggleLanAccess: () => void;
  onToggleMdns: () => void;
  onRunLanDiscovery: () => void;
  onSaveLanDiscoveryResult: (candidate: LanDiscoveryCandidate) => void;
  lanDiscoveryRunning: boolean;
  lanDiscoveryStatus: string;
  lanDiscoveryResults: LanDiscoveryCandidate[];
}

interface SettingsPageProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  settingsState: SettingsPageState;
}

function OutputBlock({ text }: { text: string }) {
  if (!text) return null;
  return (
    <pre
      style={{
        fontSize: 12,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        maxHeight: 220,
        overflow: "auto",
        background: "var(--bg-hover)",
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
      }}
    >
      {text}
    </pre>
  );
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function BackupOptionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SettingsSectionTitle({ children, danger = false }: { children: string; danger?: boolean }) {
  return <h3 style={{ marginTop: "20px", marginBottom: "12px", color: danger ? "var(--error)" : undefined }}>{children}</h3>;
}

function CurrentInstanceSection({ currentInstance }: { currentInstance?: SettingsPageState["currentInstance"] }) {
  return (
    <>
      <SettingsSectionTitle>当前实例</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">{currentInstance?.name || "未选择实例"}</div>
            <div className="setting-description">
              {currentInstance ? `类型：${getInstanceTypeLabel(currentInstance.type)} ｜ 地址：${currentInstance.baseUrl}` : "当前未检测到实例，请先在侧边栏选择要操作的实例。"}
            </div>
            {currentInstance ? <div className="setting-description" style={{ marginTop: 6 }}>{getInstanceCapabilitySummary(currentInstance)}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function SecuritySettingsSection({ settings, onToggleWhitelist, onToggleFileAccess }: { settings: SettingsState; onToggleWhitelist: () => void; onToggleFileAccess: () => void }) {
  return (
    <>
      <SettingsSectionTitle>安全设置</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">启用白名单</div>
            <div className="setting-description">只允许白名单用户访问</div>
          </div>
          <div className={`toggle-switch ${settings.whitelistEnabled ? "on" : "off"}`} onClick={onToggleWhitelist}>
            <div className="toggle-slider"></div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">文件访问权限</div>
            <div className="setting-description">允许 AI 读写本地文件</div>
          </div>
          <div className={`toggle-switch ${settings.fileAccessEnabled ? "on" : "off"}`} onClick={onToggleFileAccess}>
            <div className="toggle-slider"></div>
          </div>
        </div>
      </div>
    </>
  );
}

function AppSettingsSection({
  appSettings,
  onToggleLanAccess,
  onToggleMdns,
  onRunLanDiscovery,
  onSaveLanDiscoveryResult,
  lanDiscoveryRunning,
  lanDiscoveryStatus,
  lanDiscoveryResults,
}: {
  appSettings: SettingsPageState["appSettings"];
  onToggleLanAccess: () => void;
  onToggleMdns: () => void;
  onRunLanDiscovery: () => void;
  onSaveLanDiscoveryResult: (candidate: LanDiscoveryCandidate) => void;
  lanDiscoveryRunning: boolean;
  lanDiscoveryStatus: string;
  lanDiscoveryResults: LanDiscoveryCandidate[];
}) {
  return (
    <>
      <SettingsSectionTitle>应用设置</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} />允许局域网实例
            </div>
            <div className="setting-description">关闭后，新增远端实例时只允许 localhost 或 127.0.0.1</div>
          </div>
          <div className={`toggle-switch ${appSettings.allowLanAccess ? "on" : "off"}`} onClick={onToggleLanAccess}>
            <div className="toggle-slider"></div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Radar size={16} />局域网发现（mDNS）
            </div>
            <div className="setting-description">
              {appSettings.mdnsEnabled ? "已开启局域网发现。" : "关闭时不会进行局域网发现。"}
            </div>
          </div>
          <div className={`toggle-switch ${appSettings.mdnsEnabled ? "on" : "off"}`} onClick={onToggleMdns}>
            <div className="toggle-slider"></div>
          </div>
        </div>
        <div className="setting-item" style={{ alignItems: "flex-start", flexDirection: "column" }}>
          <div className="setting-info" style={{ width: "100%" }}>
            <div className="setting-name">局域网扫描</div>
            <div className="setting-description">扫描同一局域网内可接入的 OpenClaw 实例。</div>
            {lanDiscoveryStatus ? <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>{lanDiscoveryStatus}</div> : null}
            {lanDiscoveryResults.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {lanDiscoveryResults.map((item: LanDiscoveryCandidate, index: number) => (
                  <div key={`${item.baseUrl}-${index}`} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{item.baseUrl}</div>
                        {item.hint ? <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{item.hint}</div> : null}
                      </div>
                      <button className="btn btn-secondary" onClick={() => onSaveLanDiscoveryResult(item)}>保存为实例</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={onRunLanDiscovery} disabled={lanDiscoveryRunning}>
              {lanDiscoveryRunning ? "扫描中..." : "扫描局域网"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function BackupSection({
  backupStatus,
  backupCommandOutput,
  backupArchivePath,
  backupOptions,
  setBackupOptions,
  previewBackupPlan,
  createBackupNow,
  verifyBackupNow,
  restoreBackupNow,
}: {
  backupStatus: string;
  backupCommandOutput: string;
  backupArchivePath: string;
  backupOptions: BackupCreateOptions;
  setBackupOptions: SettingsPageState["setBackupOptions"];
  previewBackupPlan: () => Promise<void>;
  createBackupNow: () => Promise<void>;
  verifyBackupNow: (archivePath?: string) => Promise<void>;
  restoreBackupNow: (archivePath?: string) => Promise<void>;
}) {
  const [backupFilePath, setBackupFilePath] = useState(backupArchivePath || "");
  const [backupFileActionHint, setBackupFileActionHint] = useState<"校验" | "还原">("校验");

  useEffect(() => {
    if (backupArchivePath?.trim()) {
      setBackupFilePath(backupArchivePath.trim());
    }
  }, [backupArchivePath]);

  const chooseBackupOutputDirectory = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: backupOptions.output || undefined,
        title: "选择备份输出目录",
      });
      if (typeof selected === "string") {
        setBackupOptions((prev) => ({ ...prev, output: selected }));
      }
    } catch (error) {
      console.error("选择备份输出目录失败", error);
    }
  };

  const chooseBackupFile = async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        defaultPath: backupFilePath || undefined,
        title: "选择备份文件",
        filters: [{ name: "备份文件", extensions: ["tar", "gz", "tgz", "zip"] }],
      });
      if (typeof selected === "string") {
        setBackupFilePath(selected);
      }
    } catch (error) {
      console.error("选择备份文件失败", error);
    }
  };

  return (
    <>
      <SettingsSectionTitle>备份</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item" style={{ alignItems: "flex-start", flexDirection: "column" }}>
          <div className="setting-info" style={{ width: "100%" }}>
            <div className="setting-name" style={{ display: "flex", alignItems: "center", gap: 8 }}><DatabaseBackup size={16} />配置备份 / 校验 / 还原</div>
            <div className="setting-description" style={{ marginTop: 6 }}>当前版本已提供备份创建、预览、校验与还原入口；还原仍按命令投递语义执行，完成状态请结合实例日志继续确认。</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>说明：点击“预览备份”会固定按预演方式执行；下方 `--dry-run` 开关用于控制“创建备份”按钮是否只预演、不实际落盘。</div>

            <div className="form-group" style={{ marginTop: 12, width: "100%" }}>
              <label>输出目录（可选，对应 `--output &lt;path&gt;`）</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={backupOptions.output || ""}
                  onChange={(e) => setBackupOptions((prev) => ({ ...prev, output: e.target.value }))}
                  placeholder="如：~/Backups"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={() => void chooseBackupOutputDirectory()}>
                  <FolderOpen size={16} />选择目录
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <BackupOptionToggle label="创建后立即校验（--verify）" checked={Boolean(backupOptions.verify)} onChange={(value) => setBackupOptions((prev) => ({ ...prev, verify: value }))} />
              <BackupOptionToggle label="仅备份配置（--only-config）" checked={Boolean(backupOptions.onlyConfig)} onChange={(value) => setBackupOptions((prev) => ({ ...prev, onlyConfig: value }))} />
              <BackupOptionToggle label="不包含 workspace（--no-include-workspace）" checked={backupOptions.includeWorkspace === false} onChange={(value) => setBackupOptions((prev) => ({ ...prev, includeWorkspace: value ? false : true }))} />
              <BackupOptionToggle label="仅预演，不实际创建（--dry-run）" checked={Boolean(backupOptions.dryRun)} onChange={(value) => setBackupOptions((prev) => ({ ...prev, dryRun: value }))} />
            </div>

            {backupArchivePath ? <div style={{ marginTop: 10, fontSize: 13 }}>最近备份：{backupArchivePath}</div> : null}
            {backupStatus ? <div style={{ marginTop: 10, fontSize: 13 }}>{backupStatus}</div> : null}

            <div className="form-group" style={{ marginTop: 12, width: "100%" }}>
              <label>备份文件路径（用于{backupFileActionHint}）</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={backupFilePath}
                  onChange={(e) => setBackupFilePath(e.target.value)}
                  placeholder={`如：~/Backups/2026-04-02-openclaw-backup.tar.gz（用于${backupFileActionHint}）`}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={() => void chooseBackupFile()}>
                  <FolderOpen size={16} />为{backupFileActionHint}选择备份文件
                </button>
              </div>
            </div>

            <OutputBlock text={backupCommandOutput} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={() => void previewBackupPlan()}>预览备份</button>
            <button className="btn btn-primary" onClick={() => void createBackupNow()}>创建备份</button>
            <button
              className="btn btn-secondary"
              onMouseEnter={() => setBackupFileActionHint("校验")}
              onFocus={() => setBackupFileActionHint("校验")}
              onClick={() => {
                setBackupFileActionHint("校验");
                void verifyBackupNow(backupFilePath || undefined);
              }}
              disabled={!backupFilePath.trim()}
            >
              校验备份
            </button>
            <button
              className="btn btn-danger"
              onMouseEnter={() => setBackupFileActionHint("还原")}
              onFocus={() => setBackupFileActionHint("还原")}
              onClick={() => {
                setBackupFileActionHint("还原");
                void restoreBackupNow(backupFilePath || undefined);
              }}
              disabled={!backupFilePath.trim()}
            >
              还原备份
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function AdvancedSettingsSection({ currentInstance, configPath, dataPath, darkMode, setDarkMode, openConfigDir }: {
  currentInstance?: SettingsPageState["currentInstance"];
  configPath: string;
  dataPath: string;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  openConfigDir: () => void;
}) {
  return (
    <>
      <SettingsSectionTitle>高级设置</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">配置文件目录</div>
            <div className="setting-description">{configPath || "待检测"}</div>
          </div>
          <button className="btn btn-secondary" onClick={openConfigDir} disabled={!supportsHostFileOps(currentInstance)} title={!supportsHostFileOps(currentInstance) ? "当前实例不是本机，暂不支持从管理器直接打开配置目录" : ""}>打开目录</button>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">数据目录</div>
            <div className="setting-description">{dataPath || "待检测"}</div>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-name">深色模式</div>
            <div className="setting-description">切换应用主题</div>
          </div>
          <button className="btn btn-secondary" onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Moon size={18} /> : <Sun size={18} />}</button>
        </div>
      </div>
    </>
  );
}

function DangerZoneSection({ currentInstance, setShowUninstallConfirm }: { currentInstance?: SettingsPageState["currentInstance"]; setShowUninstallConfirm: (value: boolean) => void }) {
  return (
    <>
      <SettingsSectionTitle danger>危险区域</SettingsSectionTitle>
      <div className="settings-list">
        <div className="setting-item" style={{ border: "1px solid var(--error)", borderRadius: "8px", padding: "12px" }}>
          <div className="setting-info">
            <div className="setting-name" style={{ color: "var(--error)" }}>卸载 OpenClaw</div>
            <div className="setting-description">{!supportsDirectUninstall(currentInstance) ? "当前实例不是本机，不提供 UI 内一键卸载；请登录对应机器或容器平台手动处理。" : "以下操作不可撤销，请谨慎操作"}</div>
          </div>
          <button className="btn btn-danger" onClick={() => setShowUninstallConfirm(true)} disabled={!supportsDirectUninstall(currentInstance)} title={!supportsDirectUninstall(currentInstance) ? "当前实例不是本机，暂不支持从管理器直接卸载" : ""}>卸载</button>
        </div>
      </div>
    </>
  );
}

export function SettingsPage({ darkMode, setDarkMode, settingsState }: SettingsPageProps) {
  const {
    settings,
    currentInstance,
    appSettings,
    updateStatus,
    appVersion,
    hasManagerUpdate,
    configPath,
    dataPath,
    checkingUpdate,
    showUninstallConfirm,
    setShowUninstallConfirm,
    gatewayControlState,
    systemLoading,
    backupStatus,
    backupCommandOutput,
    backupArchivePath,
    backupOptions,
    setBackupOptions,
    checkForUpdates,
    openDownloadUrl,
    uninstallOpenClaw,
    openConfigDir,
    previewBackupPlan,
    createBackupNow,
    verifyBackupNow,
    restoreBackupNow,
    onToggleWhitelist,
    onToggleFileAccess,
    onToggleLanAccess,
    onToggleMdns,
    onRunLanDiscovery,
    onSaveLanDiscoveryResult,
    lanDiscoveryRunning,
    lanDiscoveryStatus,
    lanDiscoveryResults,
  } = settingsState;

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">
          <Settings size={22} />
          <h2>设置</h2>
        </div>

        <CurrentInstanceSection currentInstance={currentInstance} />
        <SecuritySettingsSection settings={settings} onToggleWhitelist={onToggleWhitelist} onToggleFileAccess={onToggleFileAccess} />
        <AppSettingsSection
          appSettings={appSettings}
          onToggleLanAccess={onToggleLanAccess}
          onToggleMdns={onToggleMdns}
          onRunLanDiscovery={onRunLanDiscovery}
          onSaveLanDiscoveryResult={onSaveLanDiscoveryResult}
          lanDiscoveryRunning={lanDiscoveryRunning}
          lanDiscoveryStatus={lanDiscoveryStatus}
          lanDiscoveryResults={lanDiscoveryResults}
        />
        <BackupSection
          backupStatus={backupStatus}
          backupCommandOutput={backupCommandOutput}
          backupArchivePath={backupArchivePath}
          backupOptions={backupOptions}
          setBackupOptions={setBackupOptions}
          previewBackupPlan={previewBackupPlan}
          createBackupNow={createBackupNow}
          verifyBackupNow={verifyBackupNow}
          restoreBackupNow={restoreBackupNow}
        />
        <AdvancedSettingsSection currentInstance={currentInstance} configPath={configPath} dataPath={dataPath} darkMode={darkMode} setDarkMode={setDarkMode} openConfigDir={openConfigDir} />
        <DangerZoneSection currentInstance={currentInstance} setShowUninstallConfirm={setShowUninstallConfirm} />

        <UninstallConfirmModal open={showUninstallConfirm} onClose={() => setShowUninstallConfirm(false)} onConfirm={uninstallOpenClaw} />
      </div>
    </div>
  );
}
