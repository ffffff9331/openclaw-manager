import { create } from "zustand";
import type { AppInstance, AuditLogEntry } from "../types/core";
import {
  loadInstances,
  saveInstances,
  createManualInstance,
  loadSettings,
  saveSettings,
  type CreateInstanceInput,
} from "../services/instanceService";
import { appendAuditLog, clearAuditLogs, loadAuditLogs } from "../services/auditLogService";

interface AppSettings {
  mdnsEnabled: boolean;
  allowLanAccess: boolean;
}

interface AppStoreState {
  instances: AppInstance[];
  currentInstanceId: string | null;
  settings: AppSettings;
  auditLogs: AuditLogEntry[];
  setInstances: (instances: AppInstance[]) => void;
  setCurrentInstance: (instanceId: string) => void;
  addInstance: (input: CreateInstanceInput) => AppInstance;
  deleteInstance: (instanceId: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  recordAudit: (entry: Omit<AuditLogEntry, "id" | "at">) => void;
  clearAudit: () => void;
}

const initialInstances = loadInstances();
const initialCurrent = initialInstances.find((item) => item.isCurrent)?.id || initialInstances[0]?.id || null;
const initialSettings = loadSettings();
const initialAuditLogs = loadAuditLogs();

export const useAppStore = create<AppStoreState>()((set) => ({
  instances: initialInstances,
  currentInstanceId: initialCurrent,
  settings: initialSettings,
  auditLogs: initialAuditLogs,
  setInstances: (instances: AppInstance[]) => {
    saveInstances(instances);
    set({ instances });
  },
  setCurrentInstance: (instanceId: string) => {
    set((state: AppStoreState) => {
      const nextInstances = state.instances.map((item: AppInstance) => ({
        ...item,
        isCurrent: item.id === instanceId,
      }));
      saveInstances(nextInstances);
      return {
        currentInstanceId: instanceId,
        instances: nextInstances,
      };
    });
  },
  addInstance: (input: CreateInstanceInput) => {
    const instance = createManualInstance(input);
    set((state: AppStoreState) => {
      const next = state.instances
        .map((item: AppInstance) => ({ ...item, isCurrent: false }))
        .concat({ ...instance, isCurrent: true });
      saveInstances(next);
      return { instances: next, currentInstanceId: instance.id };
    });
    return instance;
  },
  deleteInstance: (instanceId: string) => {
    set((state: AppStoreState) => {
      const next = state.instances.filter((item: AppInstance) => item.id !== instanceId);
      const nextCurrentId = next.find((item: AppInstance) => item.isCurrent)?.id || next[0]?.id || null;
      const nextInstances = next.map((item: AppInstance) => ({
        ...item,
        isCurrent: item.id === nextCurrentId,
      }));
      saveInstances(nextInstances);
      return { instances: nextInstances, currentInstanceId: nextCurrentId };
    });
  },
  updateSettings: (patch: Partial<AppSettings>) => {
    set((state: AppStoreState) => {
      const next = { ...state.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    });
  },
  recordAudit: (entry) => {
    const next = appendAuditLog(entry);
    set({ auditLogs: next });
  },
  clearAudit: () => {
    clearAuditLogs();
    set({ auditLogs: [] });
  },
}));
