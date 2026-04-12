import { useCallback, useMemo, useState } from "react";
import { discoverLanInstances, type LanDiscoveryCandidate } from "../services/lanDiscoveryService";
import { OverviewPage } from "../pages/OverviewPage";
import { GatewayPage } from "../pages/GatewayPage";
import { AppLogsPage } from "../pages/AppLogsPage";
import { DoctorPage } from "../pages/DoctorPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ModelsPage } from "../pages/ModelsPage";
import { SkillsPage } from "../pages/SkillsPage";
import { TasksPage } from "../pages/TasksPage";
import { ChatPage } from "../pages/ChatPage";
import { useChatChannels } from "../hooks/useChatChannels";
import { useTasksState } from "../hooks/useTasksState";
import { useSkillsState } from "../hooks/useSkillsState";
import { useModelsState } from "../hooks/useModelsState";
import { useSystemState } from "../hooks/useSystemState";
import { useTabRefresh } from "../hooks/useTabRefresh";
import { useAppStore } from "../stores/appStore";
import type { AppInstance } from "../types/core";
import type { TabKey } from "./AppSidebar";
import type { useGatewayState } from "../hooks/useGatewayState";

interface AppContentProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onOpenAddInstance: () => Promise<void> | void;
  onAddDetectedLocal: () => Promise<void> | void;
  detectingLocal: boolean;
  localInstanceStatus?: {
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null;
  darkMode: boolean;
  toggleTheme: () => void;
  systemLoading: string | null;
  gatewayState: ReturnType<typeof useGatewayState>;
}

export function AppContent({
  activeTab,
  setActiveTab,
  onOpenAddInstance,
  onAddDetectedLocal,
  detectingLocal,
  localInstanceStatus,
  darkMode,
  toggleTheme,
  systemLoading,
  gatewayState,
}: AppContentProps) {
  const instances = useAppStore((state) => state.instances);
  const currentInstanceId = useAppStore((state) => state.currentInstanceId);
  const currentInstance = instances.find((item) => item.id === currentInstanceId);
  const currentInstanceSummary = useMemo(
    () => (currentInstance ? { name: currentInstance.name, type: currentInstance.type, baseUrl: currentInstance.baseUrl } : undefined),
    [currentInstance],
  );
  const auditLogs = useAppStore((state) => state.auditLogs);
  const clearAudit = useAppStore((state) => state.clearAudit);

  const {
    gatewayStatus,
    gatewayControlState,
    liveLogs,
    checkGatewayStatus,
    fetchLogs,
    refreshGatewayControlState,
    handleGatewayControl,
  } = gatewayState;

  switch (activeTab) {
    case "overview":
      return (
        <OverviewTabContent
          currentInstance={currentInstance}
          instances={instances}
          auditLogCount={auditLogs.length}
          onNavigate={setActiveTab}
          onOpenAddInstance={onOpenAddInstance}
          onAddDetectedLocal={onAddDetectedLocal}
          gatewayStatus={gatewayStatus}
          gatewayControlState={gatewayControlState}
          localInstanceStatus={localInstanceStatus ?? null}
          detectingLocal={detectingLocal}
          onStartGateway={async () => {
            return await handleGatewayControl("start");
          }}
          onRefreshGateway={checkGatewayStatus}
        />
      );
    case "chat":
      return <ChatTabContent currentInstance={currentInstance} systemLoading={systemLoading} auditLogs={auditLogs} clearAudit={clearAudit} />;
    case "gateway":
      return <GatewayTabContent currentInstance={currentInstance} currentInstanceSummary={currentInstanceSummary} systemLoading={systemLoading} gatewayState={gatewayState} />;
    case "tasks":
      return <TasksTabContent currentInstance={currentInstance} />;
    case "models":
      return <ModelsTabContent currentInstance={currentInstance} currentInstanceSummary={currentInstanceSummary} />;
    case "skills":
      return <SkillsTabContent currentInstance={currentInstance} />;
    case "doctor":
      return <DoctorTabContent currentInstance={currentInstance} systemLoading={systemLoading} gatewayState={gatewayState} />;
    case "applogs":
      return <AppLogsTabContent currentInstance={currentInstance} currentInstanceSummary={currentInstanceSummary} auditLogs={auditLogs} clearAudit={clearAudit} />;
    case "settings":
      return <SettingsTabContent currentInstance={currentInstance} darkMode={darkMode} toggleTheme={toggleTheme} systemLoading={systemLoading} gatewayState={gatewayState} />;
    default:
      return null;
  }
}

function OverviewTabContent({
  currentInstance,
  instances,
  auditLogCount,
  onNavigate,
  onOpenAddInstance,
  onAddDetectedLocal,
  gatewayStatus,
  gatewayControlState,
  localInstanceStatus,
  detectingLocal,
  onStartGateway,
  onRefreshGateway,
}: {
  currentInstance: AppInstance | undefined;
  instances: AppInstance[];
  auditLogCount: number;
  onNavigate: (tab: TabKey) => void;
  onOpenAddInstance: () => Promise<void> | void;
  onAddDetectedLocal: () => Promise<void> | void;
  gatewayStatus: ReturnType<typeof useGatewayState>["gatewayStatus"];
  gatewayControlState: ReturnType<typeof useGatewayState>["gatewayControlState"];
  localInstanceStatus: {
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null;
  detectingLocal: boolean;
  onStartGateway: () => Promise<void | import("../hooks/useGatewayState").GatewayActionFeedback>;
  onRefreshGateway: () => Promise<void>;
}) {
  const modelsState = useModelsState({ currentInstance });

  useTabRefresh({
    activeTab: "overview",
    minIntervalMs: 45000,
    initialRefreshers: [async () => {
      await Promise.allSettled([onRefreshGateway(), modelsState.refreshCurrentModel()]);
    }],
    refreshers: {},
  });

  const currentModelLabel = modelsState.currentModelProvider && modelsState.currentModel
    ? `${modelsState.currentModelProvider}/${modelsState.currentModel}`
    : modelsState.currentModel || "—";

  return (
    <OverviewPage
      instances={instances}
      currentInstance={currentInstance}
      gatewayRunning={gatewayStatus.running}
      gatewayLoading={!gatewayStatus.port}
      auditLogCount={auditLogCount}
      currentModelLabel={currentModelLabel}
      currentModelLoading={modelsState.modelsLoading && !modelsState.currentModel}
      onNavigate={onNavigate}
      onOpenAddInstance={onOpenAddInstance}
      onAddDetectedLocal={onAddDetectedLocal}
      gatewayControlState={gatewayControlState}
      localDetection={localInstanceStatus}
      detectingLocal={detectingLocal}
      onStartGateway={onStartGateway}
      onRefreshRuntime={async () => {
        await Promise.allSettled([onRefreshGateway(), modelsState.refreshCurrentModel()]);
      }}
    />
  );
}

function ChatTabContent({
  currentInstance,
  systemLoading,
  auditLogs,
  clearAudit,
}: {
  currentInstance: AppInstance | undefined;
  systemLoading: string | null;
  auditLogs: ReturnType<typeof useAppStore.getState>["auditLogs"];
  clearAudit: () => void;
}) {
  const chatChannels = useChatChannels({ currentInstance, setSystemLoading: () => {} });
  return <ChatPage {...chatChannels} auditLogs={auditLogs} clearAuditLogs={clearAudit} systemLoading={systemLoading} />;
}

function GatewayTabContent({
  currentInstance,
  currentInstanceSummary,
  systemLoading,
  gatewayState,
}: {
  currentInstance: AppInstance | undefined;
  currentInstanceSummary: { name: string; type: AppInstance["type"]; baseUrl: string } | undefined;
  systemLoading: string | null;
  gatewayState: ReturnType<typeof useGatewayState>;
}) {
  useTabRefresh({
    activeTab: "gateway",
    minIntervalMs: 45000,
    initialRefreshers: [async () => {
      await Promise.allSettled([gatewayState.checkGatewayStatus(), gatewayState.refreshGatewayControlState()]);
    }],
    refreshers: {},
  });

  const gatewayPageState = {
    currentInstance: currentInstanceSummary,
    gatewayStatus: gatewayState.gatewayStatus,
    gatewayControlState: gatewayState.gatewayControlState,
    systemLoading,
    liveLogs: gatewayState.liveLogs,
    onStart: () => void gatewayState.handleGatewayControl("start"),
    onStop: () => void gatewayState.handleGatewayControl("stop"),
    onRestart: () => void gatewayState.handleGatewayControl("restart"),
    onRefresh: async () => {
      await Promise.allSettled([gatewayState.checkGatewayStatus(), gatewayState.refreshGatewayControlState()]);
    },
    onRefreshLogs: gatewayState.fetchLogs,
  };

  return <GatewayPage gatewayState={gatewayPageState} />;
}

function TasksTabContent({ currentInstance }: { currentInstance: AppInstance | undefined }) {
  const tasksState = useTasksState({ currentInstance });

  useTabRefresh({
    activeTab: "tasks",
    minIntervalMs: 45000,
    initialRefreshers: [tasksState.loadCronData],
    refreshers: {},
  });

  const tasksPageState = {
    currentInstance,
    cronJobs: tasksState.cronJobs,
    cronStatus: tasksState.cronStatus,
    cronRuns: tasksState.cronRuns,
    selectedCronJobId: tasksState.selectedCronJobId,
    cronJobForm: tasksState.cronJobForm,
    cronLoading: tasksState.cronLoading,
    cronError: tasksState.cronError,
    cronSubmitting: tasksState.cronSubmitting,
    showCronCreateModal: tasksState.showCronCreateModal,
    setShowCronCreateModal: tasksState.setShowCronCreateModal,
    setSelectedCronJobId: tasksState.setSelectedCronJobId,
    setCronJobForm: tasksState.setCronJobForm,
    startCreateCronJob: tasksState.startCreateCronJob,
    startEditCronJob: tasksState.startEditCronJob,
    loadCronData: tasksState.loadCronData,
    loadCronRuns: tasksState.loadCronRuns,
    submitCronJob: tasksState.submitCronJob,
    toggleCronJobEnabled: tasksState.toggleCronJobEnabled,
    deleteCronJob: tasksState.deleteCronJob,
    runCronJobNow: tasksState.runCronJobNow,
  };

  return <TasksPage tasksState={tasksPageState} />;
}

function ModelsTabContent({
  currentInstance,
  currentInstanceSummary,
}: {
  currentInstance: AppInstance | undefined;
  currentInstanceSummary: { name: string; type: AppInstance["type"]; baseUrl: string } | undefined;
}) {
  const modelsState = useModelsState({ currentInstance });

  useTabRefresh({
    activeTab: "models",
    minIntervalMs: 45000,
    initialRefreshers: [modelsState.refreshModels],
    refreshers: {},
  });

  const modelsPageState = {
    currentInstance: currentInstanceSummary,
    modelConfigs: modelsState.modelConfigs,
    connectivityResults: modelsState.connectivityResults,
    connectivityLoading: modelsState.connectivityLoading,
    modelsLoading: modelsState.modelsLoading,
    currentModel: modelsState.currentModel,
    currentModelProvider: modelsState.currentModelProvider,
    modelsStatus: modelsState.modelsStatus,
    modelsError: modelsState.modelsError,
    showAddModelModal: modelsState.showAddModelModal,
    lastSwitchFeedback: modelsState.lastSwitchFeedback,
    setShowAddModelModal: modelsState.setShowAddModelModal,
    newModelConfig: modelsState.newModelConfig,
    setNewModelConfig: modelsState.setNewModelConfig,
    editingModel: modelsState.editingModel,
    setEditingModel: modelsState.setEditingModel,
    editModelForm: modelsState.editModelForm,
    setEditModelForm: modelsState.setEditModelForm,
    refreshModels: modelsState.refreshModels,
    testConnectivity: modelsState.testConnectivity,
    testAllConnectivity: modelsState.testAllConnectivity,
    moveModel: modelsState.moveModel,
    addModel: modelsState.addModel,
    saveModelEdit: modelsState.saveModelEdit,
    setDefaultModel: modelsState.setDefaultModel,
    deleteModel: modelsState.deleteModel,
    openEditModel: modelsState.openEditModel,
  };

  return <ModelsPage modelsState={modelsPageState} />;
}

function SkillsTabContent({ currentInstance }: { currentInstance: AppInstance | undefined }) {
  const skillsState = useSkillsState({ currentInstance, setSystemLoading: () => {} });

  useTabRefresh({
    activeTab: "skills",
    minIntervalMs: 45000,
    initialRefreshers: [skillsState.refreshSkills],
    refreshers: {},
  });

  const skillsPageState = {
    currentInstance,
    skills: skillsState.skills,
    skillsLoading: skillsState.skillsLoading,
    skillsStatus: skillsState.skillsStatus,
    skillsError: skillsState.skillsError,
    onRefresh: () => void skillsState.refreshSkills(),
    onToggle: (skill: (typeof skillsState.skills)[number]) => void skillsState.toggleSkillEnabled(skill),
    onEdit: (skill: (typeof skillsState.skills)[number]) => void skillsState.editSkill(skill),
  };

  return <SkillsPage skillsState={skillsPageState} />;
}

function DoctorTabContent({
  currentInstance,
  systemLoading,
}: {
  currentInstance: AppInstance | undefined;
  systemLoading: string | null;
  gatewayState: ReturnType<typeof useGatewayState>;
}) {
  const systemState = useSystemState({ currentInstance, setSystemLoading: () => {} });
  const tasksState = useTasksState({ currentInstance });

  useTabRefresh({
    activeTab: "doctor",
    minIntervalMs: 45000,
    initialRefreshers: [() => systemState.loadSystemInfo({ checkUpdates: false })],
    refreshers: {},
  });

  const doctorPageState = {
    currentInstance,
    systemInfo: systemState.systemInfo,
    doctorResult: systemState.doctorResult,
    runDoctor: systemState.runDoctor,
    refreshDoctorResult: systemState.refreshDoctorResult,
    checkingUpdate: systemState.checkingUpdate,
    updateStatus: systemState.updateStatus,
    appVersion: systemState.appVersion,
    managerLatestVersion: systemState.managerLatestVersion,
    hasManagerUpdate: systemState.hasManagerUpdate,
    runCommand: (command: string, item?: { cmd: string; action?: "restartGateway" }) => tasksState.runCommand(item?.cmd || command, item),
    commandRunning: tasksState.commandRunning,
    cmdResult: tasksState.cmdResult,
    customCommands: tasksState.customCommands,
    showAddModal: tasksState.showAddModal,
    setShowAddModal: tasksState.setShowAddModal,
    newCmd: tasksState.newCmd,
    setNewCmd: tasksState.setNewCmd,
    addCustomCommand: tasksState.addCustomCommand,
    deleteCommand: tasksState.deleteCommand,
    systemLoading,
  };

  return <DoctorPage doctorState={doctorPageState} />;
}

function AppLogsTabContent({
  currentInstance,
  currentInstanceSummary,
  auditLogs,
  clearAudit,
}: {
  currentInstance: AppInstance | undefined;
  currentInstanceSummary: { name: string; type: AppInstance["type"]; baseUrl: string } | undefined;
  auditLogs: ReturnType<typeof useAppStore.getState>["auditLogs"];
  clearAudit: () => void;
}) {
  const systemState = useSystemState({ currentInstance, setSystemLoading: () => {} });

  useTabRefresh({
    activeTab: "applogs",
    minIntervalMs: 45000,
    initialRefreshers: [],
    refreshers: {},
  });

  const appLogsPageState = {
    currentInstance: currentInstanceSummary,
    appLogs: systemState.appLogs,
    auditLogs,
    onRefresh: systemState.loadAppLogs,
    onClearAudit: clearAudit,
  };

  return <AppLogsPage appLogsState={appLogsPageState} />;
}

function SettingsTabContent({
  currentInstance,
  darkMode,
  toggleTheme,
  systemLoading,
  gatewayState,
}: {
  currentInstance: AppInstance | undefined;
  darkMode: boolean;
  toggleTheme: () => void;
  systemLoading: string | null;
  gatewayState: ReturnType<typeof useGatewayState>;
}) {
  const appSettings = useAppStore((state) => state.settings);
  const updateAppSettings = useAppStore((state) => state.updateSettings);
  const addInstance = useAppStore((state) => state.addInstance);
  const systemState = useSystemState({ currentInstance, setSystemLoading: () => {} });
  const [lanDiscoveryRunning, setLanDiscoveryRunning] = useState(false);
  const [lanDiscoveryStatus, setLanDiscoveryStatus] = useState("");
  const [lanDiscoveryResults, setLanDiscoveryResults] = useState<LanDiscoveryCandidate[]>([]);
  const currentInstanceSummary = useMemo(
    () => (currentInstance ? { name: currentInstance.name, type: currentInstance.type, baseUrl: currentInstance.baseUrl } : undefined),
    [currentInstance],
  );

  useTabRefresh({
    activeTab: "settings",
    minIntervalMs: 45000,
    initialRefreshers: [() => systemState.loadSystemInfo({ checkUpdates: false })],
    refreshers: {},
  });

  const runLanDiscovery = useCallback(async () => {
    setLanDiscoveryRunning(true);
    try {
      if (!appSettings.mdnsEnabled) {
        setLanDiscoveryStatus("请先开启局域网发现（mDNS）后再扫描。");
        setLanDiscoveryResults([]);
        return;
      }

      const discovered = await discoverLanInstances();
      if (discovered.length === 0) {
        setLanDiscoveryStatus("未发现可接入的 OpenClaw 实例。可稍后重试，或先手动添加实例。");
        setLanDiscoveryResults([]);
        return;
      }

      setLanDiscoveryStatus(`已发现 ${discovered.length} 个局域网候选实例；请逐个保存后再做连接验证。`);
      setLanDiscoveryResults(discovered);
    } catch (error) {
      setLanDiscoveryStatus(error instanceof Error ? error.message : "局域网扫描失败");
      setLanDiscoveryResults([]);
    } finally {
      setLanDiscoveryRunning(false);
    }
  }, [appSettings.mdnsEnabled]);

  const handleToggleLanAccess = useCallback(() => {
    updateAppSettings({ allowLanAccess: !appSettings.allowLanAccess });
  }, [appSettings.allowLanAccess, updateAppSettings]);

  const handleToggleMdns = useCallback(() => {
    updateAppSettings({ mdnsEnabled: !appSettings.mdnsEnabled });
  }, [appSettings.mdnsEnabled, updateAppSettings]);

  const handleSaveLanDiscoveryResult = useCallback((candidate: LanDiscoveryCandidate) => {
    addInstance({
      name: candidate.name,
      type: candidate.type,
      baseUrl: candidate.baseUrl,
      apiBasePath: "/",
      healthPath: "/health",
      status: "unknown",
      source: "discovered",
      notes: candidate.hint || "通过局域网扫描添加",
    });
    setLanDiscoveryStatus(`已保存实例：${candidate.name}`);
  }, [addInstance]);

  const settingsPageState = useMemo(() => ({
    settings: systemState.settings,
    currentInstance: currentInstanceSummary,
    appSettings,
    updateStatus: systemState.updateStatus,
    appVersion: systemState.appVersion,
    managerLatestVersion: systemState.managerLatestVersion,
    hasManagerUpdate: systemState.hasManagerUpdate,
    configPath: systemState.systemInfo?.configPath || "",
    dataPath: systemState.systemInfo?.dataPath || "",
    checkingUpdate: systemState.checkingUpdate,
    showUninstallConfirm: systemState.showUninstallConfirm,
    setShowUninstallConfirm: systemState.setShowUninstallConfirm,
    installGuide: systemState.installGuide,
    canInstallOpenClaw: systemState.canInstallOpenClaw,
    gatewayControlState: gatewayState.gatewayControlState,
    systemLoading,
    installStatus: systemState.installStatus,
    installCommandOutput: systemState.installCommandOutput,
    backupStatus: systemState.backupStatus,
    backupCommandOutput: systemState.backupCommandOutput,
    backupArchivePath: systemState.backupArchivePath,
    backupVerifyPath: systemState.backupVerifyPath,
    setBackupVerifyPath: systemState.setBackupVerifyPath,
    backupRestorePath: systemState.backupRestorePath,
    setBackupRestorePath: systemState.setBackupRestorePath,
    backupOptions: systemState.backupOptions,
    setBackupOptions: systemState.setBackupOptions,
    checkForUpdates: systemState.checkForUpdates,
    openDownloadUrl: systemState.openDownloadUrl,
    uninstallOpenClaw: systemState.uninstallOpenClaw,
    openConfigDir: systemState.openConfigDir,
    checkInstallStatus: systemState.checkInstallStatus,
    installOpenClawNow: systemState.installOpenClawNow,
    onInstallService: () => void gatewayState.manageLaunchAgent("install"),
    onEnableService: () => void gatewayState.manageLaunchAgent("load"),
    onDisableService: () => void gatewayState.manageLaunchAgent("unload"),
    onRemoveService: () => void gatewayState.manageLaunchAgent("remove"),
    previewBackupPlan: systemState.previewBackupPlan,
    createBackupNow: systemState.createBackupNow,
    verifyBackupNow: systemState.verifyBackupNow,
    restoreBackupNow: systemState.restoreBackupNow,
    onToggleWhitelist: systemState.toggleWhitelist,
    onToggleFileAccess: systemState.toggleFileAccess,
    onToggleLanAccess: handleToggleLanAccess,
    onToggleMdns: handleToggleMdns,
    onRunLanDiscovery: () => void runLanDiscovery(),
    onSaveLanDiscoveryResult: handleSaveLanDiscoveryResult,
    lanDiscoveryRunning,
    lanDiscoveryStatus,
    lanDiscoveryResults,
  }), [
    appSettings,
    currentInstanceSummary,
    gatewayState,
    handleSaveLanDiscoveryResult,
    handleToggleLanAccess,
    handleToggleMdns,
    lanDiscoveryResults,
    lanDiscoveryRunning,
    lanDiscoveryStatus,
    runLanDiscovery,
    systemLoading,
    systemState,
  ]);

  return <SettingsPage darkMode={darkMode} setDarkMode={toggleTheme} settingsState={settingsPageState} />;
}
