import { useMemo, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { AppInstance } from "../types/core";
import { detectLocalInstance } from "../services/instanceService";

interface CreateInstanceInput {
  name: string;
  type: AppInstance["type"];
  baseUrl: string;
  apiBasePath: string;
  healthPath: string;
  notes: string;
}

export function useInstanceSelection() {
  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false);
  const [localInstanceStatus, setLocalInstanceStatus] = useState<{
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null>(null);
  const [detectingLocal, setDetectingLocal] = useState(false);

  const instances = useAppStore((state) => state.instances);
  const currentInstanceId = useAppStore((state) => state.currentInstanceId);
  const settings = useAppStore((state) => state.settings);
  const setCurrentInstance = useAppStore((state) => state.setCurrentInstance);
  const addInstance = useAppStore((state) => state.addInstance);

  const currentInstance = useMemo(
    () => instances.find((item) => item.id === currentInstanceId) || instances[0],
    [instances, currentInstanceId],
  );

  const handleCreateInstance = (input: CreateInstanceInput) => {
    addInstance({
      ...input,
      source: "manual",
      status: "unknown",
    } satisfies Partial<AppInstance>);
    setShowAddInstanceModal(false);
  };

  const handleDetectLocalInstance = async () => {
    setDetectingLocal(true);
    try {
      const result = await detectLocalInstance();
      setLocalInstanceStatus(result);
    } catch (err) {
      setLocalInstanceStatus({
        exists: false,
        running: false,
        baseUrl: "http://127.0.0.1:18789/",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDetectingLocal(false);
    }
  };

  const handleAddDetectedLocal = () => {
    if (!(localInstanceStatus?.exists && localInstanceStatus?.running)) {
      return null;
    }

    const existing = instances.find((item) => item.type === "local" && item.baseUrl === localInstanceStatus.baseUrl);
    if (existing) {
      setCurrentInstance(existing.id);
      setLocalInstanceStatus(null);
      setShowAddInstanceModal(false);
      return existing;
    }

    const created = addInstance({
      name: "本机 OpenClaw（自动检测）",
      type: "local",
      baseUrl: localInstanceStatus.baseUrl,
      apiBasePath: "/",
      healthPath: "/health",
      notes: "通过本机检测自动添加",
      source: "discovered",
      status: "online",
    });
    if (created?.id) {
      setCurrentInstance(created.id);
    }
    setLocalInstanceStatus(null);
    setShowAddInstanceModal(false);
    return created;
  };

  return {
    instances,
    currentInstanceId,
    currentInstance,
    setCurrentInstance,
    allowLanAccess: settings.allowLanAccess,
    showAddInstanceModal,
    setShowAddInstanceModal,
    handleCreateInstance,
    localInstanceStatus,
    detectingLocal,
    handleDetectLocalInstance,
    handleAddDetectedLocal,
  };
}
