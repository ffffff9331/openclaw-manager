import { useMemo, useState } from "react";
import type { TabKey } from "../components/AppSidebar";
import type { GatewayActionFeedback } from "../hooks/useGatewayState";
import type { AppInstance, GatewayControlState } from "../types/core";
import { getGatewayStatus } from "../services/gatewayService";
import { loadCurrentModel } from "../services/modelService";
import { getInstanceBoundaryHint, getInstanceCapabilitySummary, getInstanceTypeLabel } from "../lib/instanceCapabilities";

interface OverviewPageProps {
  instances: AppInstance[];
  currentInstance?: AppInstance;
  gatewayRunning?: boolean;
  gatewayLoading?: boolean;
  auditLogCount?: number;
  currentModelLabel?: string;
  currentModelLoading?: boolean;
  onNavigate?: (tab: TabKey) => void;
  onOpenAddInstance?: () => Promise<void> | void;
  onStartGateway?: () => Promise<GatewayActionFeedback | void> | GatewayActionFeedback | void;
  onRefreshRuntime?: () => Promise<void> | void;
  onAddDetectedLocal?: () => Promise<void> | void;
  gatewayControlState?: GatewayControlState;
  localDetection?: {
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null;
  detectingLocal?: boolean;
}

type DeploymentState = "not-configured" | "runtime-ready" | "healthy" | "attention";
type DeploymentPrimaryAction = "detect-local" | "start-gateway" | "refresh";

interface DeploymentCopy {
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
  primaryTarget?: TabKey;
  secondaryTarget?: TabKey;
  primaryAction?: DeploymentPrimaryAction;
  status: string;
  accent: "primary" | "success" | "warning" | "secondary";
}

function getPlatformPlan() {
  if (typeof navigator === "undefined") {
    return {
      platformLabel: "当前设备",
      recommendedPlan: "优先按当前设备选择本机运行包，Windows 默认走 WSL2。",
      primaryAction: "查看部署方案",
      helper: "首次进入先确认平台，再决定是本机运行还是 WSL2。",
    };
  }

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes("mac") || userAgent.includes("mac os")) {
    return {
      platformLabel: "macOS",
      recommendedPlan: "推荐本机运行包：下载后解压，直接接入本机实例。",
      primaryAction: "下载并接入本机运行包",
      helper: "macOS 安装链最短，适合默认做成下载即用。",
    };
  }

  if (platform.includes("win") || userAgent.includes("windows")) {
    return {
      platformLabel: "Windows",
      recommendedPlan: "推荐 WSL2 运行方案：Manager 在 Windows，OpenClaw runtime 在 WSL2。",
      primaryAction: "初始化 WSL2 运行环境",
      helper: "先走 WSL2，能避开原生安装的大部分 PATH / 权限 / 服务坑。",
    };
  }

  return {
    platformLabel: "Linux",
    recommendedPlan: "推荐本机运行包：适合本机与轻量服务器。",
    primaryAction: "下载并接入 Linux 运行包",
    helper: "Linux 环境最适合直接跑 runtime，本机和服务器都顺手。",
  };
}

function getDeploymentState(currentInstance: AppInstance | undefined, gatewayRunning: boolean | undefined, hasError: boolean): DeploymentState {
  if (!currentInstance) return "not-configured";
  if (hasError) return "attention";
  if (gatewayRunning) return "healthy";
  return "runtime-ready";
}

function getDeploymentCopy(
  state: DeploymentState,
  platformPlan: ReturnType<typeof getPlatformPlan>,
  currentInstance?: AppInstance,
  localDetection?: {
    exists: boolean;
    running: boolean;
    baseUrl: string;
    error?: string;
  } | null,
): DeploymentCopy {
  if (state === "not-configured") {
    if (localDetection?.exists && localDetection.running) {
      return {
        eyebrow: "已发现本机实例",
        title: "发现可接入的 OpenClaw",
        description: `已检测到本机 OpenClaw 正在 ${localDetection.baseUrl} 运行，现在可以直接接入 manager。`,
        primary: "一键接入本机实例",
        secondary: "查看其他部署方式",
        primaryAction: "detect-local" as const,
        primaryTarget: "settings" as TabKey,
        secondaryTarget: "doctor" as TabKey,
        status: "可接入",
        accent: "success" as const,
      };
    }

    return {
      eyebrow: "首次部署",
      title: "部署 OpenClaw",
      description: `当前未接入实例。${platformPlan.recommendedPlan}`,
      primary: "检测本机并开始接入",
      secondary: "查看其他部署方式",
      primaryAction: "detect-local" as const,
      primaryTarget: "settings" as TabKey,
      secondaryTarget: "doctor" as TabKey,
      status: "未部署",
      accent: "primary" as const,
    };
  }

  if (state === "healthy") {
    return {
      eyebrow: "运行正常",
      title: "OpenClaw 运行状态",
      description: `当前已接入 ${currentInstance?.name || "实例"}，Gateway 正在运行，可以直接进入控制与维护。`,
      primary: "刷新运行状态",
      secondary: "查看诊断详情",
      primaryAction: "refresh" as const,
      primaryTarget: "gateway" as TabKey,
      secondaryTarget: "doctor" as TabKey,
      status: "运行中",
      accent: "success" as const,
    };
  }

  if (state === "attention") {
    return {
      eyebrow: "需要处理",
      title: "OpenClaw 需要修复",
      description: `当前实例已接入，但健康读取存在异常。建议先看诊断，再决定修复或重新接入。`,
      primary: "重新检测状态",
      secondary: "查看修复建议",
      primaryAction: "refresh" as const,
      primaryTarget: "doctor" as TabKey,
      secondaryTarget: "settings" as TabKey,
      status: "待修复",
      accent: "warning" as const,
    };
  }

  return {
    eyebrow: "已接入未运行",
    title: "OpenClaw 已接入，等待启动",
    description: `已检测到 ${currentInstance?.name || "实例"}，但 Gateway 当前未运行。可以先检查运行链路，再决定启动或修复。`,
    primary: "启动 Gateway",
    secondary: "查看部署方式",
    primaryAction: "start-gateway" as const,
    primaryTarget: "gateway" as TabKey,
    secondaryTarget: "settings" as TabKey,
    status: "已接入",
    accent: "secondary" as const,
  };
}

export function OverviewPage({ instances, currentInstance, gatewayRunning, gatewayLoading, auditLogCount, currentModelLabel, currentModelLoading, onNavigate, onOpenAddInstance, onStartGateway, onRefreshRuntime, onAddDetectedLocal, gatewayControlState, localDetection, detectingLocal }: OverviewPageProps) {
  const onlineCount = instances.filter((item) => item.status === "online").length;
  const offlineCount = instances.filter((item) => item.status === "offline").length;
  const unknownCount = instances.filter((item) => item.status === "unknown").length;

  const [actionRunning, setActionRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [gatewayStartPhase, setGatewayStartPhase] = useState<"idle" | "pending" | "success" | "attention">("idle");

  const overviewGatewayRunning = gatewayRunning;
  const overviewGatewayLoading = Boolean(gatewayLoading);
  const overviewModelLabel = currentModelLabel || "";
  const overviewModelLoading = Boolean(currentModelLoading);
  const overviewError = null;

  const platformPlan = useMemo(() => getPlatformPlan(), []);
  const deploymentState = getDeploymentState(currentInstance, overviewGatewayRunning, false);
  const deploymentCopy = getDeploymentCopy(deploymentState, platformPlan, currentInstance, localDetection);

  const handlePrimaryAction = async () => {
    try {
      setActionRunning(true);
      setActionMessage(null);
      if (deploymentCopy.primaryAction !== "start-gateway") {
        setGatewayStartPhase("idle");
      }
      if (deploymentCopy.primaryAction === "detect-local") {
        if (localDetection?.exists && localDetection.running) {
          await onAddDetectedLocal?.();
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          await onRefreshRuntime?.();
          setActionMessage("已接入检测到的本机 OpenClaw，并已切到当前实例、刷新首页状态。");
          return;
        }
        await onOpenAddInstance?.();
        setActionMessage("已打开新增实例入口，并开始探测本机 OpenClaw。若检测成功，首页会直接给出一键接入入口。");
        return;
      }
      if (deploymentCopy.primaryAction === "start-gateway") {
        setGatewayStartPhase("pending");
        const feedback = await onStartGateway?.();
        await onRefreshRuntime?.();

        if (feedback && typeof feedback === "object" && "running" in feedback) {
          const started = Boolean(feedback.running);
          setGatewayStartPhase(started ? "success" : "attention");
          const nextMessage = started
            ? `Gateway 已启动成功，首页状态已刷新。${feedback.dispatchMessage ? ` 回执：${feedback.dispatchMessage}` : ""}`
            : `已发起 Gateway 启动，但当前仍未读到运行中状态。${feedback.controlState?.lastResult ? ` 控制结果：${feedback.controlState.lastResult}` : "建议去网关页看控制状态和日志。"}`;
          setActionMessage(nextMessage);
          return;
        }

        setGatewayStartPhase("pending");
        setActionMessage("已触发 Gateway 启动，并刷新首页状态。");
        return;
      }
      if (deploymentCopy.primaryAction === "refresh") {
        await onRefreshRuntime?.();
        setActionMessage("已重新读取运行状态。");
        return;
      }
      if (deploymentCopy.primaryTarget) {
        onNavigate?.(deploymentCopy.primaryTarget);
      }
    } catch (error) {
      if (deploymentCopy.primaryAction === "start-gateway") {
        setGatewayStartPhase("attention");
      }
      setActionMessage(error instanceof Error ? error.message : "动作执行失败");
    } finally {
      setActionRunning(false);
    }
  };

  const primaryButtonLabel = actionRunning
    ? deploymentCopy.primaryAction === "start-gateway"
      ? "启动中..."
      : "执行中..."
    : deploymentCopy.primary;

  const gatewayInlineStatus =
    deploymentCopy.primaryAction === "start-gateway"
      ? gatewayStartPhase === "pending"
        ? { label: "启动中", tone: "pending" as const }
        : gatewayStartPhase === "success"
          ? { label: "已启动", tone: "success" as const }
          : gatewayStartPhase === "attention"
            ? { label: "启动未确认", tone: "warning" as const }
            : null
      : null;

  const secondaryButtonLabel =
    deploymentCopy.primaryAction === "start-gateway" && gatewayStartPhase === "attention"
      ? "查看网关日志"
      : deploymentCopy.primaryAction === "start-gateway" && gatewayStartPhase === "success"
        ? "查看诊断详情"
        : deploymentCopy.secondary;

  const secondaryButtonTarget =
    deploymentCopy.primaryAction === "start-gateway" && gatewayStartPhase === "attention"
      ? ("gateway" as TabKey)
      : deploymentCopy.primaryAction === "start-gateway" && gatewayStartPhase === "success"
        ? ("doctor" as TabKey)
        : deploymentCopy.secondaryTarget;

  const isFailureSummary = (value?: string) => {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return ["失败", "错误", "异常", "未运行", "未读到", "error", "failed", "timeout", "denied"].some((token) =>
      normalized.includes(token),
    );
  };

  const latestGatewaySummary =
    gatewayControlState?.lastLaunchAgentError
      ? {
          tone: "warning" as const,
          title: "最近错误摘要",
          text: gatewayControlState.lastLaunchAgentRecoveryHint
            ? `${gatewayControlState.lastLaunchAgentError}｜建议：${gatewayControlState.lastLaunchAgentRecoveryHint}`
            : gatewayControlState.lastLaunchAgentError,
          actions: [
            { label: "查看日志", target: "gateway" as TabKey },
            { label: "查看修复建议", target: "doctor" as TabKey },
          ],
        }
      : gatewayControlState?.lastResult && isFailureSummary(gatewayControlState.lastResult)
        ? {
            tone: "warning" as const,
            title: "最近控制结果",
            text: gatewayControlState.lastResult,
            actions: [
              { label: "查看日志", target: "gateway" as TabKey },
              { label: "查看修复建议", target: "doctor" as TabKey },
            ],
          }
        : gatewayControlState?.lastLaunchAgentResult && isFailureSummary(gatewayControlState.lastLaunchAgentResult)
          ? {
              tone: "warning" as const,
              title: "最近控制结果",
              text: gatewayControlState.lastLaunchAgentRecoveryHint
                ? `${gatewayControlState.lastLaunchAgentResult}｜建议：${gatewayControlState.lastLaunchAgentRecoveryHint}`
                : gatewayControlState.lastLaunchAgentResult,
              actions: [
                { label: "查看日志", target: "gateway" as TabKey },
                { label: "查看修复建议", target: "doctor" as TabKey },
              ],
            }
          : gatewayStartPhase === "attention" && actionMessage
            ? {
                tone: "warning" as const,
                title: "最近错误摘要",
                text: actionMessage,
                actions: [{ label: "查看日志", target: "gateway" as TabKey }],
              }
            : null;

  return (
    <div className="page-container">
      <div className={`deployment-hero-card is-${deploymentCopy.accent}`}>
        <div className="deployment-hero-main">
          <div className="deployment-hero-eyebrow">{deploymentCopy.eyebrow}</div>
          <div className="deployment-hero-title-row">
            <h2>{deploymentCopy.title}</h2>
            <span className={`deployment-hero-status is-${deploymentCopy.accent}`}>{deploymentCopy.status}</span>
          </div>
          <div className="deployment-hero-description">{deploymentCopy.description}</div>
          <div className="deployment-hero-meta-grid">
            <div className="deployment-meta-card">
              <div className="deployment-meta-label">当前平台建议</div>
              <div className="deployment-meta-value">{platformPlan.platformLabel}</div>
              <div className="deployment-meta-note">{platformPlan.helper}</div>
            </div>
            <div className="deployment-meta-card">
              <div className="deployment-meta-label">当前实例</div>
              <div className="deployment-meta-value">{currentInstance ? currentInstance.name : "未接入"}</div>
              <div className="deployment-meta-note">{currentInstance ? `${getInstanceTypeLabel(currentInstance.type)} · ${currentInstance.baseUrl}` : localDetection?.exists && localDetection.running ? `已探测到本机实例：${localDetection.baseUrl}` : "先部署或接入一个可管理实例"}</div>
            </div>
            <div className="deployment-meta-card">
              <div className="deployment-meta-label">Gateway</div>
              <div className="deployment-meta-value">{overviewGatewayLoading ? "读取中" : overviewGatewayRunning ? "运行中" : overviewError ? "读取失败" : "未运行 / 未读取"}</div>
              <div className="deployment-meta-note">{overviewError ? `错误：${overviewError}` : localDetection?.error ? `本机探测：${localDetection.error}` : localDetection?.exists && localDetection.running ? `本机实例已就绪，可直接接入。${detectingLocal ? " 当前仍在刷新探测结果。" : ""}` : "首页状态卡应根据真实运行态自动切换，而不是永远展示安装入口。"}</div>
            </div>
          </div>
          <div className="deployment-hero-actions">
            <button className="btn btn-primary" onClick={() => void handlePrimaryAction()} disabled={actionRunning}>{primaryButtonLabel}</button>
            <button className="btn btn-secondary" onClick={() => secondaryButtonTarget && onNavigate?.(secondaryButtonTarget)}>{secondaryButtonLabel}</button>
          </div>
          {gatewayInlineStatus ? <div className={`deployment-inline-status is-${gatewayInlineStatus.tone}`}>{gatewayInlineStatus.label}</div> : null}
          {latestGatewaySummary ? (
            <div className={`deployment-control-summary is-${latestGatewaySummary.tone}`}>
              <div className="deployment-control-summary-label">{latestGatewaySummary.title}</div>
              <div className="deployment-control-summary-text">{latestGatewaySummary.text}</div>
              {latestGatewaySummary.actions?.length ? (
                <div className="deployment-control-summary-actions">
                  {latestGatewaySummary.actions.map((item) => (
                    <button key={`${item.target}-${item.label}`} className="btn btn-secondary btn-small" onClick={() => onNavigate?.(item.target)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {actionMessage ? <div className="deployment-hero-inline-note">{actionMessage}</div> : null}
        </div>
        <div className="deployment-hero-side">
          <div className="deployment-side-panel">
            <div className="deployment-side-title">推荐方案</div>
            <div className="deployment-side-summary">{platformPlan.recommendedPlan}</div>
            <ul className="deployment-side-list">
              <li>macOS / Linux：优先本机运行包</li>
              <li>Windows：默认走 WSL2 runtime</li>
              <li>已安装用户：首页改看运行状态与修复入口</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2>健康总览</h2>
        </div>
        <div className="status-grid" style={{ marginBottom: 16 }}>
          <div className="status-card"><div className="status-label">Gateway</div><div className="status-value">{overviewGatewayLoading ? "加载中" : overviewGatewayRunning ? "运行中" : overviewError ? "加载失败" : "未运行 / 未读取"}</div></div>
          <div className="status-card"><div className="status-label">当前模型</div><div className="status-value">{overviewModelLoading ? "加载中" : overviewModelLabel || "—"}</div></div>
          <div className="status-card"><div className="status-label">审计动作数</div><div className="status-value">{auditLogCount ?? 0}</div></div>
        </div>
        <div style={{ color: "var(--text-secondary)" }}>
          当前这张总览把实例健康、Gateway 运行态、模型策略读数和前端关键操作审计聚到一处，方便先看整体是否正常，再决定进哪一页深挖。
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2>当前实例主线</h2>
        </div>
        {currentInstance ? (
          <div style={{ display: "grid", gap: 10, color: "var(--text-secondary)" }}>
            <div><strong>{currentInstance.name}</strong> · {currentInstance.baseUrl}</div>
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)" }}>当前未选择实例。</div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>实例总览</h2>
        </div>
        <div className="status-grid" style={{ marginBottom: 16 }}>
          <div className="status-card"><div className="status-label">实例总数</div><div className="status-value">{instances.length}</div></div>
          <div className="status-card"><div className="status-label">在线</div><div className="status-value success">{onlineCount}</div></div>
          <div className="status-card"><div className="status-label">离线 / 未知</div><div className="status-value">{offlineCount} / {unknownCount}</div></div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {instances.map((instance) => (
            <div key={instance.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{instance.name}{currentInstance?.id === instance.id ? "（当前）" : ""}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{instance.baseUrl}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{instance.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
