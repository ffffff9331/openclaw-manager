import { useCallback, useState } from "react";
import type { AppInstance, BackupCreateOptions, SettingsState as AppSettingsState } from "../types/core";
import {
  loadAppLogs as fetchAppLogs,
  loadSystemInfo as fetchSystemInfo,
  readLatestDoctorResult,
  runDoctorCommand,
  type SystemInfo,
} from "../services/systemService";
import { useSystemActions } from "./useSystemActions";

export interface SystemState {
  systemInfo: SystemInfo | null;
  appVersion: string;
  doctorResult: string;
  appLogs: string;
  settings: AppSettingsState;
  setSettings: React.Dispatch<React.SetStateAction<AppSettingsState>>;
  updateStatus: string;
  checkingUpdate: boolean;
  managerLatestVersion: string;
  hasManagerUpdate: boolean | null;
  showUninstallConfirm: boolean;
  setShowUninstallConfirm: (value: boolean) => void;
  installGuide: ReturnType<typeof useSystemActions>["installGuide"];
  canInstallOpenClaw: boolean;
  installStatus: string;
  installCommandOutput: string;
  backupStatus: string;
  backupCommandOutput: string;
  backupArchivePath: string;
  backupVerifyPath: string;
  setBackupVerifyPath: (value: string) => void;
  backupRestorePath: string;
  setBackupRestorePath: (value: string) => void;
  backupOptions: BackupCreateOptions;
  setBackupOptions: ReturnType<typeof useSystemActions>["setBackupOptions"];
  loadSystemInfo: (options?: { checkUpdates?: boolean }) => Promise<void>;
  runDoctor: () => Promise<void>;
  refreshDoctorResult: () => Promise<void>;
  loadAppLogs: () => Promise<void>;
  toggleWhitelist: () => Promise<void>;
  toggleFileAccess: () => Promise<void>;
  uninstallOpenClaw: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  openDownloadUrl: () => Promise<void>;
  openConfigDir: () => Promise<void>;
  checkInstallStatus: () => Promise<void>;
  installOpenClawNow: () => Promise<void>;
  previewBackupPlan: () => Promise<void>;
  createBackupNow: () => Promise<void>;
  verifyBackupNow: (archivePath?: string) => Promise<void>;
  restoreBackupNow: (archivePath?: string) => Promise<void>;
}

interface UseSystemStateOptions {
  currentInstance?: AppInstance;
  setSystemLoading: (value: string | null) => void;
}

const INITIAL_SETTINGS: AppSettingsState = {
  whitelistEnabled: false,
  fileAccessEnabled: false,
};

export function useSystemState({ currentInstance, setSystemLoading }: UseSystemStateOptions): SystemState {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [doctorResult, setDoctorResult] = useState("");
  const [appLogs, setAppLogs] = useState("");
  const [settings, setSettings] = useState<AppSettingsState>(INITIAL_SETTINGS);

  const actions = useSystemActions({
    currentInstance,
    setSystemLoading,
    appVersion,
    settings,
    setSettings,
  });
  const { checkForUpdates } = actions;

  const loadSystemInfo = useCallback(async (options?: { checkUpdates?: boolean }) => {
    const shouldCheckUpdates = options?.checkUpdates ?? true;
    const loaded = await fetchSystemInfo(currentInstance, { checkUpdates: shouldCheckUpdates });
    setSystemInfo(loaded.systemInfo);
    const resolvedAppVersion = loaded.systemInfo.appVersion || "";
    setAppVersion(resolvedAppVersion);
    setSettings((prev) => ({
      ...prev,
      whitelistEnabled: loaded.whitelistEnabled,
      fileAccessEnabled: loaded.fileAccessEnabled,
    }));
    if (shouldCheckUpdates) {
      await checkForUpdates(resolvedAppVersion);
    }
  }, [checkForUpdates, currentInstance]);

  const runDoctor = useCallback(async () => {
    setSystemLoading("doctor");
    try {
      const resultMessage = await runDoctorCommand(currentInstance);
      await loadSystemInfo();
      const latest = await readLatestDoctorResult(currentInstance);
      setDoctorResult(latest || resultMessage || "诊断命令已投递，请稍后刷新结果");
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, loadSystemInfo, setSystemLoading]);

  const refreshDoctorResult = useCallback(async () => {
    await loadSystemInfo();
    const latest = await readLatestDoctorResult(currentInstance);
    setDoctorResult(latest || "暂无诊断结果");
  }, [currentInstance, loadSystemInfo]);

  const loadAppLogs = useCallback(async () => {
    const latest = await fetchAppLogs(currentInstance);
    setAppLogs(latest || "暂无 App 日志");
  }, [currentInstance]);

  return {
    systemInfo,
    appVersion,
    doctorResult,
    appLogs,
    settings,
    setSettings,
    updateStatus: actions.updateStatus,
    checkingUpdate: actions.checkingUpdate,
    managerLatestVersion: actions.managerLatestVersion,
    hasManagerUpdate: actions.hasManagerUpdate,
    showUninstallConfirm: actions.showUninstallConfirm,
    setShowUninstallConfirm: actions.setShowUninstallConfirm,
    installGuide: actions.installGuide,
    canInstallOpenClaw: actions.canInstallOpenClaw,
    installStatus: actions.installStatus,
    installCommandOutput: actions.installCommandOutput,
    backupStatus: actions.backupStatus,
    backupCommandOutput: actions.backupCommandOutput,
    backupArchivePath: actions.backupArchivePath,
    backupVerifyPath: actions.backupVerifyPath,
    setBackupVerifyPath: actions.setBackupVerifyPath,
    backupRestorePath: actions.backupRestorePath,
    setBackupRestorePath: actions.setBackupRestorePath,
    backupOptions: actions.backupOptions,
    setBackupOptions: actions.setBackupOptions,
    loadSystemInfo,
    runDoctor,
    refreshDoctorResult,
    loadAppLogs,
    toggleWhitelist: actions.toggleWhitelist,
    toggleFileAccess: actions.toggleFileAccess,
    uninstallOpenClaw: actions.uninstallOpenClaw,
    checkForUpdates: actions.checkForUpdates,
    openDownloadUrl: actions.openDownloadUrl,
    openConfigDir: actions.openConfigDir,
    checkInstallStatus: actions.checkInstallStatus,
    installOpenClawNow: actions.installOpenClawNow,
    previewBackupPlan: actions.previewBackupPlan,
    createBackupNow: actions.createBackupNow,
    verifyBackupNow: actions.verifyBackupNow,
    restoreBackupNow: actions.restoreBackupNow,
  };
}
