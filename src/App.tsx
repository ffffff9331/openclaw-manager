import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Play } from "lucide-react";
import { AddInstanceModal } from "./components/AddInstanceModal";
import { AppContent } from "./components/AppContent";
import { AppSidebar, type TabKey } from "./components/AppSidebar";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { tabTitles } from "./config/navigation";
import { useGatewayState } from "./hooks/useGatewayState";
import { useInstanceSelection } from "./hooks/useInstanceSelection";
import { useManagerAppVersion } from "./hooks/useManagerAppVersion";
import { useTheme } from "./hooks/useTheme";
import { refreshInstanceStatuses } from "./services/instanceStatusService";
import { useAppStore } from "./stores/appStore";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [systemLoading, setSystemLoading] = useState<string | null>(null);
  const [refreshingStatuses, setRefreshingStatuses] = useState(false);
  const [instanceSwitchNotice, setInstanceSwitchNotice] = useState("");
  const startupScheduledRef = useRef(false);
  const { resolvedTheme, toggleTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";
  const setInstances = useAppStore((state) => state.setInstances);
  const prevInstanceIdRef = useRef<string | null>(null);

  const {
    instances,
    currentInstanceId,
    currentInstance,
    setCurrentInstance,
    allowLanAccess,
    showAddInstanceModal,
    setShowAddInstanceModal,
    handleCreateInstance,
    localInstanceStatus,
    detectingLocal,
    handleDetectLocalInstance,
    handleAddDetectedLocal,
  } = useInstanceSelection();

  const managerAppVersion = useManagerAppVersion();
  const gatewayState = useGatewayState({ currentInstance, setSystemLoading });

  const GatewayMenuIcon = gatewayState.gatewayStatus.running ? Activity : Play;

  const runInstanceStatusRefresh = useCallback(async () => {
    setRefreshingStatuses(true);
    try {
      const next = await refreshInstanceStatuses(useAppStore.getState().instances);
      setInstances(next);
    } finally {
      setRefreshingStatuses(false);
    }
  }, [setInstances]);

  useEffect(() => {
    if (startupScheduledRef.current) {
      return;
    }
    startupScheduledRef.current = true;

    const fire = (label: string, task: () => Promise<void>) => {
      void task().catch((error) => {
        console.warn(`[startup] ${label} failed`, error);
      });
    };

    const startupTimers = [
      window.setTimeout(() => fire("instance-status", runInstanceStatusRefresh), 0),
      window.setTimeout(() => fire("gateway-status", gatewayState.checkGatewayStatus), 120),
    ];

    const timer = window.setInterval(() => {
      fire("instance-status-interval", runInstanceStatusRefresh);
    }, 300000); // 5 minutes

    return () => {
      startupTimers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(timer);
    };
  }, [gatewayState.checkGatewayStatus, runInstanceStatusRefresh]);

  useEffect(() => {
    if (!currentInstanceId || prevInstanceIdRef.current === null) {
      prevInstanceIdRef.current = currentInstanceId;
      return;
    }
    if (prevInstanceIdRef.current !== currentInstanceId && currentInstance) {
      setInstanceSwitchNotice(`已切换到 ${currentInstance.name}（${currentInstance.type}） · 当前页面操作将作用于该实例`);
      const timer = window.setTimeout(() => setInstanceSwitchNotice(""), 2500);
      prevInstanceIdRef.current = currentInstanceId;
      return () => window.clearTimeout(timer);
    }
    prevInstanceIdRef.current = currentInstanceId;
  }, [currentInstance, currentInstanceId]);

  return (
    <div className="app-container">
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        appVersion={managerAppVersion}
        instances={instances}
        currentInstanceId={currentInstanceId}
        onChangeInstance={setCurrentInstance}
        onAddInstance={() => setShowAddInstanceModal(true)}
        onRefreshStatuses={() => void runInstanceStatusRefresh()}
        refreshingStatuses={refreshingStatuses}
        gatewayIcon={GatewayMenuIcon}
      />

      <main className="main-content">
        {instanceSwitchNotice ? <div className="instance-switch-notice">{instanceSwitchNotice}</div> : null}
        <PageErrorBoundary pageName={tabTitles[activeTab]}>
          <AppContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenAddInstance={async () => {
              setShowAddInstanceModal(true);
              await handleDetectLocalInstance();
            }}
            onAddDetectedLocal={async () => {
              await handleAddDetectedLocal();
            }}
            detectingLocal={detectingLocal}
            localInstanceStatus={localInstanceStatus ? {
              exists: Boolean(localInstanceStatus.exists),
              running: Boolean(localInstanceStatus.running),
              baseUrl: localInstanceStatus.baseUrl || "http://127.0.0.1:18789",
              error: localInstanceStatus.error || undefined,
            } : null}
            darkMode={darkMode}
            toggleTheme={toggleTheme}
            systemLoading={systemLoading}
            gatewayState={gatewayState}
          />
        </PageErrorBoundary>
      </main>

      <AddInstanceModal
        open={showAddInstanceModal}
        allowLanAccess={allowLanAccess}
        localInstanceStatus={localInstanceStatus}
        detectingLocal={detectingLocal}
        onDetectLocal={handleDetectLocalInstance}
        onAddDetectedLocal={handleAddDetectedLocal}
        onClose={() => setShowAddInstanceModal(false)}
        onSubmit={handleCreateInstance}
      />
    </div>
  );
}

export default App;
