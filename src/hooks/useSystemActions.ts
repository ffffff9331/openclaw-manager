import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { formatActionError, getErrorMessage } from "../lib/errorMessage";
import { isLocalInstance } from "../lib/instanceCapabilities";
import type { AppInstance, BackupCreateOptions, InstallGuide, SettingsState as AppSettingsState } from "../types/core";
import { createBackup, previewBackup, restoreBackup, verifyBackup } from "../services/backupService";
import { checkManagerUpdates, openDownloadPage } from "../services/managerUpdateService";
import { openConfigDirectory, uninstallOpenClaw as uninstallOpenClawApp } from "../services/localSystemService";
import { checkOpenClawInstalled, getInstallGuide, installOpenClaw } from "../services/installGuideService";
import { updateFileAccessPolicy, updateWhitelistPolicy } from "../services/systemService";

interface UseSystemActionsOptions {
  currentInstance?: AppInstance;
  setSystemLoading: (value: string | null) => void;
  appVersion: string;
  settings: AppSettingsState;
  setSettings: Dispatch<SetStateAction<AppSettingsState>>;
}

const INITIAL_BACKUP_OPTIONS: BackupCreateOptions = {
  output: "",
  verify: false,
  includeWorkspace: true,
  onlyConfig: false,
  dryRun: false,
};

export function useSystemActions({
  currentInstance,
  setSystemLoading,
  appVersion,
  settings,
  setSettings,
}: UseSystemActionsOptions) {
  const [updateStatus, setUpdateStatus] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [managerLatestVersion, setManagerLatestVersion] = useState("");
  const [hasManagerUpdate, setHasManagerUpdate] = useState<boolean | null>(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [installStatus, setInstallStatus] = useState("");
  const [installCommandOutput, setInstallCommandOutput] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [backupCommandOutput, setBackupCommandOutput] = useState("");
  const [backupArchivePath, setBackupArchivePath] = useState("");
  const [backupVerifyPath, setBackupVerifyPath] = useState("");
  const [backupRestorePath, setBackupRestorePath] = useState("");
  const [backupOptions, setBackupOptions] = useState<BackupCreateOptions>(INITIAL_BACKUP_OPTIONS);

  const installGuide = useMemo<InstallGuide>(() => getInstallGuide(currentInstance), [currentInstance]);
  const canInstallOpenClaw = !currentInstance || currentInstance.type === "local";

  const applySettingsToggle = useCallback(
    async (
      key: keyof AppSettingsState,
      updater: (enabled: boolean, instance?: AppInstance) => Promise<void>,
    ) => {
      const next = !settings[key];
      setSettings((prev) => ({ ...prev, [key]: next }));
      await updater(next, currentInstance);
    },
    [currentInstance, setSettings, settings],
  );

  const toggleWhitelist = useCallback(async () => {
    await applySettingsToggle("whitelistEnabled", updateWhitelistPolicy);
  }, [applySettingsToggle]);

  const toggleFileAccess = useCallback(async () => {
    await applySettingsToggle("fileAccessEnabled", updateFileAccessPolicy);
  }, [applySettingsToggle]);

  const uninstallOpenClaw = useCallback(async () => {
    try {
      await uninstallOpenClawApp(currentInstance);
      setShowUninstallConfirm(false);
      alert("OpenClaw 已卸载");
    } catch (e) {
      alert(formatActionError("卸载失败", e));
    }
  }, [currentInstance]);

  const checkForUpdates = useCallback(async (versionOverride?: string) => {
    const versionToCheck = (versionOverride ?? appVersion).trim();
    if (!versionToCheck) {
      setUpdateStatus("检查失败：未获取到 Manager 版本");
      setHasManagerUpdate(false);
      setManagerLatestVersion("");
      setDownloadUrl("");
      return;
    }

    setCheckingUpdate(true);
    try {
      const result = await checkManagerUpdates(versionToCheck);
      setUpdateStatus(result.status);
      setHasManagerUpdate(result.hasUpdate);
      setManagerLatestVersion(result.latestVersion || "");
      setDownloadUrl(result.downloadUrl || "");
    } catch (e) {
      setUpdateStatus(formatActionError("检查失败", e, getErrorMessage(e)));
    } finally {
      setCheckingUpdate(false);
    }
  }, [appVersion]);

  const openDownloadUrl = useCallback(async () => {
    await openDownloadPage(downloadUrl);
  }, [downloadUrl]);

  const openConfigDir = useCallback(async () => {
    setSystemLoading("config-dir");
    try {
      await openConfigDirectory(currentInstance);
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, setSystemLoading]);

  const checkInstallStatus = useCallback(async () => {
    setSystemLoading("check-install");
    try {
      const result = await checkOpenClawInstalled(currentInstance);
      if (result.success) {
        const output = result.output.trim();
        setInstallStatus(output ? `已安装：${output}` : "已安装");
        setInstallCommandOutput(result.output || "");
      } else {
        setInstallStatus("未检测到 OpenClaw 安装");
        setInstallCommandOutput(result.error || result.output || "");
      }
    } catch (e) {
      const message = formatActionError("安装检查失败", e);
      setInstallStatus(message);
      setInstallCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, setSystemLoading]);

  const installOpenClawNow = useCallback(async () => {
    setSystemLoading("install-openclaw");
    try {
      const result = await installOpenClaw(currentInstance);
      if (!result.success) {
        throw new Error(result.error || result.output || "安装命令执行失败");
      }
      setInstallStatus("安装命令已执行完成");
      setInstallCommandOutput(result.output || "");
    } catch (e) {
      const message = formatActionError("安装失败", e);
      setInstallStatus(message);
      setInstallCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, setSystemLoading]);

  const previewBackupPlan = useCallback(async () => {
    setSystemLoading("backup-preview");
    try {
      const result = await previewBackup(backupOptions, currentInstance);
      setBackupStatus(result.success ? "备份预览已生成" : "备份预览失败");
      setBackupCommandOutput(result.output || result.error || "");
      if (!result.success) {
        throw new Error(result.error || result.output || "备份预览失败");
      }
    } catch (e) {
      const message = formatActionError("备份预览失败", e);
      setBackupStatus(message);
      setBackupCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [backupOptions, currentInstance, setSystemLoading]);

  const createBackupNow = useCallback(async () => {
    setSystemLoading("backup-create");
    try {
      const artifact = await createBackup(backupOptions, currentInstance);
      setBackupStatus(artifact.archivePath ? `备份命令已发起：${artifact.archivePath}` : "备份命令已发起");
      setBackupArchivePath(artifact.archivePath || "");
      setBackupVerifyPath(artifact.archivePath || backupVerifyPath);
      setBackupRestorePath(artifact.archivePath || backupRestorePath);
      setBackupCommandOutput(artifact.output || "已向当前实例投递备份命令，请随后校验结果");
    } catch (e) {
      const message = formatActionError("创建备份失败", e);
      setBackupStatus(message);
      setBackupCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [backupOptions, backupVerifyPath, backupRestorePath, currentInstance, setSystemLoading]);

  const verifyBackupNow = useCallback(async (archivePath?: string) => {
    const path = (archivePath ?? backupVerifyPath).trim();
    if (!path) {
      setBackupStatus("请先输入备份文件路径");
      return;
    }

    setSystemLoading("backup-verify");
    try {
      const artifact = await verifyBackup(path, currentInstance);
      setBackupStatus(`备份校验命令已完成：${path}`);
      setBackupCommandOutput(artifact.output || "");
      setBackupVerifyPath(path);
    } catch (e) {
      const message = formatActionError("校验备份失败", e);
      setBackupStatus(message);
      setBackupCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [backupVerifyPath, currentInstance, setSystemLoading]);

  const restoreBackupNow = useCallback(async (archivePath?: string) => {
    const path = (archivePath ?? backupRestorePath).trim();
    if (!path) {
      setBackupStatus("请先输入要还原的备份文件路径");
      return;
    }

    setSystemLoading("backup-restore");
    try {
      const artifact = await restoreBackup(path, currentInstance);
      setBackupStatus(`备份还原命令已发起：${path}`);
      setBackupCommandOutput(artifact.output || "");
      setBackupRestorePath(path);
    } catch (e) {
      const message = formatActionError("还原备份失败", e);
      setBackupStatus(message);
      setBackupCommandOutput(message);
    } finally {
      setSystemLoading(null);
    }
  }, [backupRestorePath, currentInstance, setSystemLoading]);

  return {
    updateStatus,
    checkingUpdate,
    downloadUrl,
    managerLatestVersion,
    hasManagerUpdate,
    showUninstallConfirm,
    setShowUninstallConfirm,
    toggleWhitelist,
    toggleFileAccess,
    uninstallOpenClaw,
    checkForUpdates,
    openDownloadUrl,
    openConfigDir,
    installGuide,
    canInstallOpenClaw,
    installStatus,
    installCommandOutput,
    checkInstallStatus,
    installOpenClawNow,
    backupStatus,
    backupCommandOutput,
    backupArchivePath,
    backupVerifyPath,
    setBackupVerifyPath,
    backupRestorePath,
    setBackupRestorePath,
    backupOptions,
    setBackupOptions,
    previewBackupPlan,
    createBackupNow,
    verifyBackupNow,
    restoreBackupNow,
  };
}
