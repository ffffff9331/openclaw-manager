import { useCallback, useEffect, useState } from "react";
import { formatActionError } from "../lib/errorMessage";
import { useAppStore } from "../stores/appStore";
import type { AppInstance, ModelConfig, ModelFormState, ModelSwitchFeedback } from "../types/core";
import {
  addModelConfig,
  buildEditModelForm,
  deleteModel as deleteModelProvider,
  loadCurrentModel as loadCurrentModelInfo,
  loadModelConfigs as fetchModelConfigs,
  moveModel as persistMoveModel,
  saveModelEdit as persistModelEdit,
  setDefaultModel as persistDefaultModel,
  testModelConnectivity,
  validateModelForm,
  type ModelConnectivityResult,
} from "../services/modelService";

export interface ModelsState {
  modelConfigs: ModelConfig[];
  connectivityResults: Record<string, ModelConnectivityResult | undefined>;
  connectivityLoading: boolean;
  modelsLoading: boolean;
  currentModel: string;
  currentModelProvider: string;
  modelsStatus: string;
  modelsError: string;
  showAddModelModal: boolean;
  lastSwitchFeedback: ModelSwitchFeedback | null;
  setShowAddModelModal: (value: boolean) => void;
  newModelConfig: ModelFormState;
  setNewModelConfig: (value: ModelFormState) => void;
  editingModel: ModelConfig | null;
  setEditingModel: (value: ModelConfig | null) => void;
  editModelForm: ModelFormState;
  setEditModelForm: (value: ModelFormState) => void;
  refreshCurrentModel: () => Promise<void>;
  refreshModels: () => Promise<void>;
  testConnectivity: (model: ModelConfig) => Promise<void>;
  testAllConnectivity: () => Promise<void>;
  moveModel: (provider: string, modelId: string, direction: "up" | "down") => Promise<void>;
  addModel: () => Promise<void>;
  saveModelEdit: () => Promise<void>;
  setDefaultModel: (modelId: string, provider: string) => Promise<void>;
  deleteModel: (provider: string, modelId: string) => Promise<void>;
  openEditModel: (model: ModelConfig) => void;
}

interface UseModelsStateOptions {
  currentInstance?: AppInstance;
}

const EMPTY_MODEL_FORM: ModelFormState = {
  name: "",
  id: "",
  baseUrl: "",
  apiKey: "",
  contextWindow: "128000",
  maxTokens: "8192",
};

export function useModelsState({ currentInstance }: UseModelsStateOptions): ModelsState {
  const recordAudit = useAppStore((state) => state.recordAudit);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [connectivityResults, setConnectivityResults] = useState<Record<string, ModelConnectivityResult | undefined>>({});
  const [connectivityLoading, setConnectivityLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [moveModelLoading, setMoveModelLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState("");
  const [currentModelProvider, setCurrentModelProvider] = useState("");
  const [modelsStatus, setModelsStatus] = useState("");
  const [modelsError, setModelsError] = useState("");
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [lastSwitchFeedback, setLastSwitchFeedback] = useState<ModelSwitchFeedback | null>(null);
  const [newModelConfig, setNewModelConfig] = useState<ModelFormState>(EMPTY_MODEL_FORM);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [editModelForm, setEditModelForm] = useState<ModelFormState>(EMPTY_MODEL_FORM);

  const loadModelConfigs = useCallback(async () => {
    const configs = await fetchModelConfigs(currentInstance);
    setModelConfigs(configs);
    return configs;
  }, [currentInstance]);

  const loadCurrentModel = useCallback(async () => {
    const current = await loadCurrentModelInfo(currentInstance);
    setCurrentModel(current.model);
    setCurrentModelProvider(current.provider);
    return current;
  }, [currentInstance]);

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      await Promise.all([loadModelConfigs(), loadCurrentModel()]);
      setModelsStatus("模型列表已刷新");
    } catch (e) {
      const message = formatActionError("加载模型失败", e);
      setModelsError(message);
      setModelsStatus("");
    } finally {
      setModelsLoading(false);
    }
  }, [loadCurrentModel, loadModelConfigs]);

  const testConnectivity = useCallback(async (model: ModelConfig) => {
    setConnectivityLoading(true);
    setModelsError("");
    try {
      const result = await testModelConnectivity(model);
      setConnectivityResults((prev) => ({ ...prev, [`${model.provider}:${model.id}`]: result }));
      setModelsStatus(`${model.name} 连通性测试${result.ok ? "通过" : "失败"}`);
    } catch (e) {
      setModelsError(formatActionError("连通性测试失败", e));
    } finally {
      setConnectivityLoading(false);
    }
  }, []);

  const testAllConnectivity = useCallback(async () => {
    if (!modelConfigs.length) {
      setModelsStatus("暂无可测试模型");
      return;
    }

    setConnectivityLoading(true);
    setModelsError("");
    try {
      const entries = await Promise.all(
        modelConfigs.map(async (model) => [`${model.provider}:${model.id}`, await testModelConnectivity(model)] as const),
      );
      setConnectivityResults(Object.fromEntries(entries));
      const successCount = entries.filter(([, result]) => result.ok).length;
      setModelsStatus(`批量连通性测试完成：${successCount}/${entries.length} 可达`);
    } catch (e) {
      setModelsError(formatActionError("批量连通性测试失败", e));
    } finally {
      setConnectivityLoading(false);
    }
  }, [modelConfigs]);

  const moveModel = useCallback(async (provider: string, modelId: string, direction: "up" | "down") => {
    setMoveModelLoading(true);
    setModelsError("");
    try {
      await persistMoveModel(provider, modelId, direction, currentInstance);
      await loadModelConfigs();
      setModelsStatus(`模型顺序已调整：${modelId} ${direction === "up" ? "上移" : "下移"}，Gateway 将自动重载以生效`);
    } catch (e) {
      setModelsError(formatActionError("调整模型顺序失败", e));
    } finally {
      setMoveModelLoading(false);
    }
  }, [currentInstance, loadModelConfigs]);

  const addModel = useCallback(async () => {
    setModelsError("");
    try {
      validateModelForm(newModelConfig);
    } catch (e) {
      setModelsError(formatActionError("表单校验失败", e));
      return;
    }

    setModelsLoading(true);
    try {
      await addModelConfig(newModelConfig, currentInstance);
      setShowAddModelModal(false);
      setNewModelConfig(EMPTY_MODEL_FORM);
      await loadModelConfigs();
      setModelsStatus("模型添加成功，Gateway 将自动重载以生效");
    } catch (e) {
      setModelsError(formatActionError("添加失败", e));
    } finally {
      setModelsLoading(false);
    }
  }, [currentInstance, newModelConfig, loadModelConfigs]);

  const openEditModel = useCallback((model: ModelConfig) => {
    setEditingModel(model);
    setEditModelForm(buildEditModelForm(model));
    setModelsError("");
  }, []);

  const saveModelEdit = useCallback(async () => {
    if (!editingModel) return;

    setModelsError("");
    try {
      validateModelForm(editModelForm);
    } catch (e) {
      setModelsError(formatActionError("表单校验失败", e));
      return;
    }

    setModelsLoading(true);
    try {
      await persistModelEdit(editingModel, editModelForm, currentInstance);
      setEditingModel(null);
      await loadModelConfigs();
      if (currentModelProvider === editingModel.provider && currentModel === editingModel.id) {
        await loadCurrentModel();
      }
      setModelsStatus("模型更新成功，Gateway 将自动重载以生效");
    } catch (e) {
      setModelsError(formatActionError("更新失败", e));
    } finally {
      setModelsLoading(false);
    }
  }, [currentInstance, currentModel, currentModelProvider, editModelForm, editingModel, loadCurrentModel, loadModelConfigs]);

  const setDefaultModel = useCallback(async (modelId: string, provider: string) => {
    setModelsLoading(true);
    setModelsError("");
    const beforeProvider = currentModelProvider;
    const beforeModel = currentModel;
    try {
      await persistDefaultModel(modelId, provider, currentInstance);
      const [, current] = await Promise.all([loadModelConfigs(), loadCurrentModel()]);
      const effective = current.provider === provider && current.model === modelId;
      setLastSwitchFeedback({
        targetLabel: `${provider} / ${modelId}`,
        beforeProvider,
        beforeModel,
        afterProvider: current.provider,
        afterModel: current.model,
        effective,
        message: effective
          ? `默认模型已切换为 ${provider} / ${modelId}`
          : `配置已写入，但当前读数为 ${current.provider || "未知"} / ${current.model || "未知"}`,
      });
      setModelsStatus(
        effective
          ? `默认模型已切换为 ${provider} / ${modelId}；Gateway 将自动重载以生效`
          : `默认模型配置已写入，但当前读数未完全匹配目标；请检查 override 或运行时重载`,
      );
    } catch (e) {
      const message = formatActionError("切换失败", e);
      setModelsError(message);
      setLastSwitchFeedback({
        targetLabel: `${provider} / ${modelId}`,
        beforeProvider,
        beforeModel,
        afterProvider: beforeProvider,
        afterModel: beforeModel,
        effective: false,
        message,
      });
    } finally {
      setModelsLoading(false);
    }
  }, [currentInstance, currentModel, currentModelProvider, loadCurrentModel, loadModelConfigs]);

  const deleteModel = useCallback(async (provider: string, modelId: string) => {
    if (!confirm(`确定要删除模型 ${modelId} 吗？`)) return;

    setModelsLoading(true);
    setModelsError("");
    setModelsStatus(`正在删除模型 ${modelId}...`);
    try {
      await deleteModelProvider(provider, modelId, currentInstance);
      await loadModelConfigs();
      if (currentModelProvider === provider && currentModel === modelId) {
        await loadCurrentModel();
      }
      setModelsStatus(`模型 ${modelId} 已删除，Gateway 将自动重载以生效`);
    } catch (e) {
      setModelsError(formatActionError("删除失败", e));
    } finally {
      setModelsLoading(false);
    }
  }, [currentInstance, currentModel, currentModelProvider, loadCurrentModel, loadModelConfigs]);

  const refreshCurrentModel = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      await loadCurrentModel();
    } catch (e) {
      setModelsError(formatActionError("加载当前模型失败", e));
    } finally {
      setModelsLoading(false);
    }
  }, [loadCurrentModel]);

  return {
    modelConfigs,
    connectivityResults,
    connectivityLoading,
    modelsLoading: modelsLoading || moveModelLoading,
    currentModel,
    currentModelProvider,
    modelsStatus,
    modelsError,
    showAddModelModal,
    lastSwitchFeedback,
    setShowAddModelModal,
    newModelConfig,
    setNewModelConfig,
    editingModel,
    setEditingModel,
    editModelForm,
    setEditModelForm,
    refreshCurrentModel,
    refreshModels,
    testConnectivity,
    testAllConnectivity,
    moveModel,
    addModel,
    saveModelEdit,
    setDefaultModel,
    deleteModel,
    openEditModel,
  };
}
