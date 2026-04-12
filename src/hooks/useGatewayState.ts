import { useCallback, useState } from "react";
import { formatActionError } from "../lib/errorMessage";
import type { AppInstance, GatewayControlState, GatewayStatus } from "../types/core";
import {
  getGatewayStatus,
  controlGateway,
  fetchGatewayLogs,
  getGatewayControlState,
  manageGatewayLaunchAgent,
} from "../services/gatewayService";

interface UseGatewayStateOptions {
  currentInstance?: AppInstance;
  setSystemLoading: (value: string | null) => void;
}

type GatewayAction = "start" | "stop" | "restart";
type LaunchAgentAction = "install" | "load" | "unload" | "remove";

export interface GatewayActionFeedback {
  action: GatewayAction;
  dispatchMessage: string;
  running: boolean;
  controlState: GatewayControlState;
  ok: boolean;
}

export interface GatewayState {
  gatewayStatus: GatewayStatus;
  gatewayControlState: GatewayControlState;
  liveLogs: string;
  checkGatewayStatus: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  refreshGatewayControlState: () => Promise<void>;
  handleGatewayControl: (action: GatewayAction) => Promise<GatewayActionFeedback>;
  manageLaunchAgent: (action: LaunchAgentAction) => Promise<void>;
}

const ACTION_REFRESH_WAIT_MS = {
  start: 400,
  stop: 400,
  restart: 1200,
} as const;
const RESTART_INITIAL_WAIT_MS = 1500;
const RESTART_POLL_INTERVAL_MS = 1500;
const RESTART_POLL_ATTEMPTS = 8;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useGatewayState({ currentInstance, setSystemLoading }: UseGatewayStateOptions): GatewayState {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({ running: false, port: 18789 });
  const [gatewayControlState, setGatewayControlState] = useState<GatewayControlState>({});
  const [liveLogs, setLiveLogs] = useState("");

  const checkGatewayStatus = useCallback(async () => {
    try {
      const status = await getGatewayStatus(currentInstance);
      setGatewayStatus(status);
    } catch (e) {
      console.error("Failed to fetch gateway status:", e);
      setGatewayStatus({ running: false });
    }
  }, [currentInstance]);

  const fetchLogs = useCallback(async () => {
    try {
      const output = await fetchGatewayLogs(currentInstance);
      setLiveLogs(output);
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    }
  }, [currentInstance]);

  const refreshGatewayControlState = useCallback(async () => {
    try {
      const state = await getGatewayControlState(currentInstance);
      setGatewayControlState(state);
    } catch (e) {
      console.error("Failed to fetch gateway control state:", e);
    }
  }, [currentInstance]);

  const refreshGatewayState = useCallback(async () => {
    await checkGatewayStatus();
    await fetchLogs();
    await refreshGatewayControlState();
  }, [checkGatewayStatus, fetchLogs, refreshGatewayControlState]);

  const readGatewayActionFeedback = useCallback(
    async (action: GatewayAction, dispatchMessage: string): Promise<GatewayActionFeedback> => {
      const [status, controlState] = await Promise.all([
        getGatewayStatus(currentInstance),
        getGatewayControlState(currentInstance),
      ]);

      setGatewayStatus(status);
      setGatewayControlState(controlState);

      return {
        action,
        dispatchMessage,
        running: Boolean(status.running),
        controlState,
        ok: action === "stop" ? !status.running : Boolean(status.running),
      };
    },
    [currentInstance],
  );

  const pollGatewayAfterRestart = useCallback(async () => {
    for (let attempt = 0; attempt < RESTART_POLL_ATTEMPTS; attempt += 1) {
      await wait(RESTART_POLL_INTERVAL_MS);
      await refreshGatewayState();
    }
  }, [refreshGatewayState]);

  const refreshGatewayAfterAction = useCallback(
    async (action: GatewayAction) => {
      await wait(ACTION_REFRESH_WAIT_MS[action]);
      await refreshGatewayState();

      if (action !== "restart") {
        return;
      }

      await wait(RESTART_INITIAL_WAIT_MS);
      await pollGatewayAfterRestart();
    },
    [pollGatewayAfterRestart, refreshGatewayState],
  );

  const handleGatewayControl = useCallback(async (action: GatewayAction) => {
    setSystemLoading(`gateway-${action}`);
    try {
      const dispatchMessage = await controlGateway(action, currentInstance);
      if (action === "restart") {
        setGatewayStatus((prev) => ({ ...prev, running: false, uptime: dispatchMessage }));
      } else {
        setGatewayStatus((prev) => ({ ...prev, uptime: dispatchMessage }));
      }

      await refreshGatewayAfterAction(action);
      return await readGatewayActionFeedback(action, dispatchMessage);
    } catch (e) {
      console.error(`Gateway ${action} failed:`, e);
      alert(formatActionError(`Gateway ${action} 失败`, e));
      throw e;
    } finally {
      setSystemLoading(null);
    }
  }, [currentInstance, readGatewayActionFeedback, refreshGatewayAfterAction, setSystemLoading]);

  const manageLaunchAgent = useCallback(async (action: LaunchAgentAction) => {
    setSystemLoading(`gateway-launch-agent-${action}`);
    try {
      const message = await manageGatewayLaunchAgent(action, currentInstance);
      setGatewayStatus((prev) => ({ ...prev, uptime: message }));
      window.setTimeout(() => {
        void refreshGatewayControlState().finally(() => {
          setSystemLoading(null);
        });
      }, 0);
    } catch (e) {
      console.error(`Gateway LaunchAgent ${action} failed:`, e);
      alert(formatActionError(`Gateway LaunchAgent ${action} 失败`, e));
      setSystemLoading(null);
    }
  }, [currentInstance, refreshGatewayControlState, setSystemLoading]);

  return {
    gatewayStatus,
    gatewayControlState,
    liveLogs,
    checkGatewayStatus,
    fetchLogs,
    refreshGatewayControlState,
    handleGatewayControl,
    manageLaunchAgent,
  };
}
