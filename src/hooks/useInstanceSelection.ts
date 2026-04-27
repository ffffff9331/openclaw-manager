import { useMemo, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { AppInstance } from "../types/core";
import { detectInstances, detectLocalInstance, type DetectedInstance } from "../services/instanceService";

const INSTANCE_TYPE_NAMES: Record<AppInstance["type"], string> = {
  local: "本机",
  wsl: "WSL2",
  docker: "Docker",
  nas: "NAS",
  remote: "远端",
};

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

  // 旧接口兼容
  const [localInstanceStatus, setLocalInstanceStatus] = useState<{
    exists: boolean;
    running: boolean;
    baseUrl: string;
    type?: AppInstance["type"];
    error?: string;
    detail?: string;
  } | null>(null);
  const [detectingLocal, setDetectingLocal] = useState(false);

  // 新多实例检测
  const [detectedInstances, setDetectedInstances] = useState<DetectedInstance[]>([]);
  const [detectionErrors, setDetectionErrors] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

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

  /** 全面检测所有安装方式 */
  const handleDetectInstances = async () => {
    setDetecting(true);
    setDetectedInstances([]);
    setDetectionErrors([]);
    try {
      const result = await detectInstances();
      setDetectedInstances(result.detected);
      setDetectionErrors(result.errors);
      // 同时更新旧接口状态以兼容 OverviewPage
      if (result.detected.length > 0) {
        const first = result.detected[0];
        setLocalInstanceStatus({
          exists: first.exists,
          running: first.running,
          baseUrl: first.baseUrl,
          type: first.type,
          detail: first.version || first.detail,
          error: first.error,
        });
      } else {
        setLocalInstanceStatus({
          exists: false,
          running: false,
          baseUrl: "",
          error: "未检测到任何 OpenClaw 安装",
        });
      }
    } catch (err) {
      setLocalInstanceStatus({
        exists: false,
        running: false,
        baseUrl: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDetecting(false);
      setDetectingLocal(false);
    }
  };

  /** 旧接口兼容：单实例检测 */
  const handleDetectLocalInstance = async () => {
    setDetectingLocal(true);
    try {
      const result = await detectLocalInstance();
      setLocalInstanceStatus(result);
    } catch (err) {
      setLocalInstanceStatus({
        exists: false,
        running: false,
        baseUrl: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDetectingLocal(false);
    }
  };

  /** 接入一个已检测到的实例 */
  const handleAddDetectedInstance = (detected: DetectedInstance) => {
    const existing = instances.find(
      (item) => item.type === detected.type && item.baseUrl === detected.baseUrl,
    );
    if (existing) {
      setCurrentInstance(existing.id);
      return existing;
    }

    const label = INSTANCE_TYPE_NAMES[detected.type] || detected.type;
    const notes = [
      `通过自动检测添加（${label}）`,
      detected.version ? `版本: ${detected.version}` : "",
      detected.detail || "",
    ].filter(Boolean).join("；");

    const created = addInstance({
      name: `${label} OpenClaw（自动检测）`,
      type: detected.type,
      baseUrl: detected.baseUrl,
      apiBasePath: "/",
      healthPath: "/health",
      notes,
      source: "discovered",
      status: detected.running ? "online" : "unknown",
    });
    if (created?.id) {
      setCurrentInstance(created.id);
    }
    return created;
  };

  /** 旧接口兼容 */
  const handleAddDetectedLocal = () => {
    if (!localInstanceStatus?.exists) {
      return null;
    }

    const detectedType = localInstanceStatus.type || "local";
    const existing = instances.find((item) => item.type === detectedType && item.baseUrl === localInstanceStatus.baseUrl);
    if (existing) {
      setCurrentInstance(existing.id);
      setLocalInstanceStatus(null);
      setShowAddInstanceModal(false);
      return existing;
    }

    const label = INSTANCE_TYPE_NAMES[detectedType] || detectedType;
    const created = addInstance({
      name: `${label} OpenClaw（自动检测）`,
      type: detectedType,
      baseUrl: localInstanceStatus.baseUrl,
      apiBasePath: "/",
      healthPath: "/health",
      notes: `通过自动检测添加（${label}）`,
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
    // 新多实例检测
    detectedInstances,
    detectionErrors,
    detecting,
    handleDetectInstances,
    handleAddDetectedInstance,
    // 旧接口兼容
    localInstanceStatus,
    detectingLocal,
    handleDetectLocalInstance,
    handleAddDetectedLocal,
  };
}
