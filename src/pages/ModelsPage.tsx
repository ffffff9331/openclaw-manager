import { memo, useMemo } from "react";
import { Cpu, Loader2, Plus, PlugZap, RefreshCcw } from "lucide-react";
import { ModelFormModal } from "../components/ModelFormModal";
import { ModelProviderSection } from "../components/ModelProviderSection";
import type { ModelConfig, ModelFormState } from "../types/core";

interface ModelsPageState {
  modelConfigs: ModelConfig[];
  connectivityResults: Record<string, { ok: boolean; message: string } | undefined>;
  connectivityLoading: boolean;
  modelsLoading: boolean;
  currentModel: string;
  currentModelProvider: string;
  modelsStatus: string;
  modelsError: string;
  showAddModelModal: boolean;
  lastSwitchFeedback: import("../types/core").ModelSwitchFeedback | null;
  setShowAddModelModal: (value: boolean) => void;
  closeAddModal: () => void;
  newModelConfig: ModelFormState;
  setNewModelConfig: (value: ModelFormState) => void;
  editingModel: ModelConfig | null;
  setEditingModel: (value: ModelConfig | null) => void;
  editModelForm: ModelFormState;
  setEditModelForm: (value: ModelFormState) => void;
  addModelProviderMode: string;
  setAddModelProviderMode: (value: string) => void;
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

interface ModelsPageProps {
  modelsState: ModelsPageState;
}

function getGroupedModels(modelConfigs: ModelConfig[]) {
  return modelConfigs.reduce<Record<string, ModelConfig[]>>((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {});
}

const ModelPageFeedback = memo(function ModelPageFeedback({
  lastSwitchFeedback,
  modelsError,
  modelsStatus,
}: {
  lastSwitchFeedback: import("../types/core").ModelSwitchFeedback | null;
  modelsError: string;
  modelsStatus: string;
}) {
  return (
    <>
      {lastSwitchFeedback ? (
        <div className="cmd-result" style={{ marginBottom: 16, borderColor: lastSwitchFeedback.effective ? "var(--success)" : "var(--warning)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>最近切换反馈</div>
          <div style={{ fontSize: 13 }}>{lastSwitchFeedback.message}</div>
        </div>
      ) : null}

      {modelsError ? (
        <div className="cmd-result" style={{ marginBottom: 16, borderColor: "var(--error)" }}>
          <div style={{ color: "var(--error)", fontWeight: 600, marginBottom: 6 }}>模型操作失败</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{modelsError}</div>
        </div>
      ) : null}

      {modelsStatus && !modelsError ? (
        <div className="cmd-result" style={{ marginBottom: 16, borderColor: "var(--success)" }}>
          <div style={{ color: "var(--success)", fontWeight: 600, marginBottom: 6 }}>最新状态</div>
          <div style={{ fontSize: 13 }}>{modelsStatus}</div>
        </div>
      ) : null}
    </>
  );
});

const ModelPageToolbar = memo(function ModelPageToolbar({
  modelsLoading,
  connectivityLoading,
  setShowAddModelModal,
  refreshModels,
  testAllConnectivity,
}: {
  modelsLoading: boolean;
  connectivityLoading: boolean;
  setShowAddModelModal: (value: boolean) => void;
  refreshModels: () => Promise<void>;
  testAllConnectivity: () => Promise<void>;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "12px" }}>
      <button className="btn btn-primary" onClick={() => setShowAddModelModal(true)} disabled={modelsLoading}>
        <Plus size={16} /> 添加自定义模型
      </button>
      <button className="btn btn-secondary" onClick={() => void refreshModels()} disabled={modelsLoading}>
        {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} 刷新模型
      </button>
      <button className="btn btn-secondary" onClick={() => void testAllConnectivity()} disabled={modelsLoading || connectivityLoading}>
        <PlugZap size={16} /> {connectivityLoading ? "批量测试中" : "批量连通性测试"}
      </button>
    </div>
  );
});

const ModelsEmptyState = memo(function ModelsEmptyState({
  modelsLoading,
  hasModels,
}: {
  modelsLoading: boolean;
  hasModels: boolean;
}) {
  if (modelsLoading && !hasModels) {
    return <div style={{ textAlign: "center", padding: "40px", color: "gray" }}><div className="loading-spinner">加载中...</div></div>;
  }

  if (hasModels || modelsLoading) {
    return null;
  }

  return (
    <div style={{ textAlign: "center", padding: "40px", color: "gray" }}>
      <Cpu size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
      <p>暂无模型配置</p>
      <p style={{ fontSize: "13px" }}>点击上方“添加自定义模型”开始补齐</p>
    </div>
  );
});

const ModelProvidersSection = memo(function ModelProvidersSection({
  groupedModels,
  currentModel,
  currentModelProvider,
  connectivityResults,
  connectivityLoading,
  modelsLoading,
  openEditModel,
  deleteModel,
  setDefaultModel,
  testConnectivity,
  moveModel,
}: {
  groupedModels: Record<string, ModelConfig[]>;
  currentModel: string;
  currentModelProvider: string;
  connectivityResults: Record<string, { ok: boolean; message: string } | undefined>;
  connectivityLoading: boolean;
  modelsLoading: boolean;
  openEditModel: (model: ModelConfig) => void;
  deleteModel: (provider: string, modelId: string) => Promise<void>;
  setDefaultModel: (modelId: string, provider: string) => Promise<void>;
  testConnectivity: (model: ModelConfig) => Promise<void>;
  moveModel: (provider: string, modelId: string, direction: "up" | "down") => Promise<void>;
}) {
  const normalizedCurrentModel = currentModel.includes("/") ? currentModel.split("/").slice(1).join("/") : currentModel;

  return (
    <>
      {Object.entries(groupedModels).map(([provider, models]) => (
        <ModelProviderSection
          key={provider}
          provider={provider}
          models={models}
          currentModel={normalizedCurrentModel}
          currentModelProvider={currentModelProvider}
          connectivityResults={connectivityResults}
          connectivityLoading={connectivityLoading}
          busy={modelsLoading}
          onEdit={openEditModel}
          onDelete={deleteModel}
          onSetDefault={setDefaultModel}
          onTestConnectivity={testConnectivity}
          onMove={moveModel}
        />
      ))}
    </>
  );
});

const ModelModals = memo(function ModelModals({
  showAddModelModal,
  newModelConfig,
  setNewModelConfig,
  setShowAddModelModal,
  closeAddModal,
  addModel,
  modelsLoading,
  editingModel,
  editModelForm,
  setEditModelForm,
  setEditingModel,
  saveModelEdit,
  modelsError,
  existingProviders,
  addModelProviderMode,
  setAddModelProviderMode,
}: {
  showAddModelModal: boolean;
  newModelConfig: ModelFormState;
  setNewModelConfig: (value: ModelFormState) => void;
  setShowAddModelModal: (value: boolean) => void;
  closeAddModal: () => void;
  addModel: () => Promise<void>;
  modelsLoading: boolean;
  editingModel: ModelConfig | null;
  editModelForm: ModelFormState;
  setEditModelForm: (value: ModelFormState) => void;
  setEditingModel: (value: ModelConfig | null) => void;
  saveModelEdit: () => Promise<void>;
  modelsError: string;
  existingProviders: string[];
  addModelProviderMode: string;
  setAddModelProviderMode: (value: string) => void;
}) {
  return (
    <>
      {showAddModelModal && (
        <ModelFormModal
          title="添加模型"
          form={newModelConfig}
          setForm={setNewModelConfig}
          onClose={closeAddModal}
          onSubmit={addModel}
          submitLabel={modelsLoading ? "提交中..." : "添加"}
          existingProviders={existingProviders}
          providerMode={addModelProviderMode}
          onProviderModeChange={setAddModelProviderMode}
        />
      )}

      {editingModel && (
        <ModelFormModal title="编辑模型" form={editModelForm} setForm={setEditModelForm} onClose={() => setEditingModel(null)} onSubmit={saveModelEdit} submitLabel={modelsLoading ? "保存中..." : "保存"} error={modelsError} apiKeyPlaceholder="留空则保持不变" />
      )}
    </>
  );
});

export function ModelsPage({ modelsState }: ModelsPageProps) {
  const {
    modelConfigs,
    connectivityResults,
    connectivityLoading,
    modelsLoading,
    currentModel,
    currentModelProvider,
    lastSwitchFeedback,
    modelsStatus,
    modelsError,
    showAddModelModal,
    setShowAddModelModal,
    closeAddModal,
    newModelConfig,
    setNewModelConfig,
    editingModel,
    setEditingModel,
    editModelForm,
    setEditModelForm,
    refreshModels,
    testConnectivity,
    testAllConnectivity,
    moveModel,
    addModel,
    saveModelEdit,
    setDefaultModel,
    deleteModel,
    openEditModel,
    addModelProviderMode,
    setAddModelProviderMode,
  } = modelsState;

  const groupedModels = getGroupedModels(modelConfigs);
  const existingProviders = useMemo(() => Object.keys(groupedModels), [groupedModels]);

  return (
    <div className="page-container">
      <div className="card">
        <div className="card-header">
          <Cpu size={22} />
          <h2>模型管理</h2>
        </div>

        <ModelPageFeedback lastSwitchFeedback={lastSwitchFeedback} modelsError={modelsError} modelsStatus={modelsStatus} />

        <ModelPageToolbar
          modelsLoading={modelsLoading}
          connectivityLoading={connectivityLoading}
          setShowAddModelModal={setShowAddModelModal}
          refreshModels={refreshModels}
          testAllConnectivity={testAllConnectivity}
        />

        <ModelProvidersSection
          groupedModels={groupedModels}
          currentModel={currentModel}
          currentModelProvider={currentModelProvider}
          connectivityResults={connectivityResults}
          connectivityLoading={connectivityLoading}
          modelsLoading={modelsLoading}
          openEditModel={openEditModel}
          deleteModel={deleteModel}
          setDefaultModel={setDefaultModel}
          testConnectivity={testConnectivity}
          moveModel={moveModel}
        />

        <ModelsEmptyState modelsLoading={modelsLoading} hasModels={modelConfigs.length > 0} />
      </div>

      <ModelModals
        showAddModelModal={showAddModelModal}
        newModelConfig={newModelConfig}
        setNewModelConfig={setNewModelConfig}
        setShowAddModelModal={setShowAddModelModal}
        closeAddModal={closeAddModal}
        addModel={addModel}
        modelsLoading={modelsLoading}
        editingModel={editingModel}
        editModelForm={editModelForm}
        setEditModelForm={setEditModelForm}
        setEditingModel={setEditingModel}
        saveModelEdit={saveModelEdit}
        modelsError={modelsError}
        existingProviders={existingProviders}
        addModelProviderMode={addModelProviderMode}
        setAddModelProviderMode={setAddModelProviderMode}
      />
    </div>
  );
}
