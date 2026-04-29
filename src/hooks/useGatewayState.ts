import { useCallback, useEffect, useState } from "react";
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
  start: 1400,
  stop: 800,
  restart: 1800,
} as const;
const RESTART_INITIAL_WAIT_MS = 1800;
const RESTART_POLL_INTERVAL_MS = 1500;
const RESTART_POLL_ATTEMPTS = 8;
const START_POLL_INTERVAL_MS = 1200;
const START_POLL_ATTEMPTS = 8;
const STOP_POLL_INTERVAL_MS = 1000;
const STOP_POLL_ATTEMPTS = 5;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useGatewayState({ currentInstance, setSystemLoading }: UseGatewayStateOptions): GatewayState {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({ running: false });
  const [gatewayControlState, setGatewayControlState] = useState<GatewayControlState>({});
  const [liveLogs, setLiveLogs] = useState("");

  useEffect(() => {
    setGatewayStatus({ running: false });
    setGatewayControlState({});
    setLiveLogs("");

    if (!currentInstance) {
      return;
    }

    void (async () => {
      try {
        const [status, controlState, logs] = await Promise.all([
          getGatewayStatus(currentInstance),
          getGatewayControlState(currentInstance),
          fetchGatewayLogs(currentInstance),
        ]);
        setGatewayStatus(status);
        setGatewayControlState(controlState);
        setLiveLogs(logs);
      } catch (e) {
        console.error("Failed to refresh gateway state after instance switch:", e);
      }
    })();
  }, [currentInstance]);

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
    await refreshGatewayControlState();
  }, [checkGatewayStatus, refreshGatewayControlState]);

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

  const pollGatewayUntilExpectedState = useCallback(async (expectedRunning: boolean, attempts: number, intervalMs: number) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await wait(intervalMs);
      const status = await getGatewayStatus(currentInstance);
      const controlState = await getGatewayControlState(currentInstance);
      setGatewayStatus(status);
      setGatewayControlState(controlState);
      if (Boolean(status.running) === expectedRunning) {
        return { status, controlState };
      }
    }
    return null;
  }, [currentInstance]);

  const refreshGatewayAfterAction = useCallback(
    async (action: GatewayAction) => {
      await wait(ACTION_REFRESH_WAIT_MS[action]);
      await refreshGatewayState();

      if (action === "restart") {
        await wait(RESTART_INITIAL_WAIT_MS);
        await pollGatewayAfterRestart();
        return;
      }

      if (action === "start") {
        await pollGatewayUntilExpectedState(true, START_POLL_ATTEMPTS, START_POLL_INTERVAL_MS);
        return;
      }

      if (action === "stop") {
        await pollGatewayUntilExpectedState(false, STOP_POLL_ATTEMPTS, STOP_POLL_INTERVAL_MS);
      }
    },
    [pollGatewayAfterRestart, pollGatewayUntilExpectedState, refreshGatewayState],
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
      await refreshGatewayControlState();
    } catch (e) {
      console.error(`Gateway LaunchAgent ${action} failed:`, e);
      alert(formatActionError(`Gateway LaunchAgent ${action} 失败`, e));
    } finally {
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
