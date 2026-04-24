import type { AppInstance, AppInstanceType } from "../types/core";

type InstanceLike = Pick<AppInstance, "type"> | undefined;

const INSTANCE_TYPE_LABELS: Record<AppInstanceType, string> = {
  local: "本机",
  wsl: "WSL2",
  docker: "Docker",
  nas: "NAS",
  remote: "远端",
};

export function isLocalInstance(instance?: InstanceLike): boolean {
  return !instance || instance.type === "local";
}

export function isManagedByHost(instance?: InstanceLike): boolean {
  return isLocalInstance(instance) || instance?.type === "wsl";
}

export function supportsHostFileOps(instance?: InstanceLike): boolean {
  return isManagedByHost(instance);
}

export function supportsHostServiceManagement(instance?: InstanceLike): boolean {
  return isManagedByHost(instance);
}

export function supportsDirectUninstall(instance?: InstanceLike): boolean {
  return isManagedByHost(instance);
}

export function getInstanceTypeLabel(type?: AppInstanceType): string {
  if (!type) return "本机";
  return INSTANCE_TYPE_LABELS[type] || type;
}

export function getInstanceBoundaryHint(instance?: InstanceLike): string {
  if (!instance || instance.type === "local" || instance.type === "wsl") {
    return "";
  }
  return "当前实例不是本机，请到对应机器或容器平台侧处理。";
}

export function getInstanceCapabilitySummary(instance?: InstanceLike): string {
  if (!instance || instance.type === "local") {
    return "支持本机宿主能力、配置目录直开、服务管理与本地安装。";
  }
  if (instance.type === "wsl") {
    return "WSL2 实例：Manager 运行在 Windows，OpenClaw runtime 运行在 WSL2，命令通过 wsl.exe 桥接。";
  }
  if (instance.type === "docker") {
    return "容器实例：优先通过 HTTP/API 管理，宿主文件与服务管理请在 Docker 平台侧处理。";
  }
  if (instance.type === "nas") {
    return "NAS 实例：优先通过 HTTP/API 管理，目录权限、挂载路径与容器网络请在 NAS 平台侧处理。";
  }
  return "远端实例：优先通过 HTTP/API 管理，宿主文件与服务管理请在目标机器侧处理。";
}

export function getInstanceBoundaryBadges(instance?: InstanceLike): string[] {
  if (!instance || instance.type === "local") {
    return ["仅本机可用", "宿主能力可用", "桌面环境直连"];
  }
  if (instance.type === "wsl") {
    return ["WSL2 runtime", "wsl.exe 桥接", "Windows 本机管理"];
  }
  if (instance.type === "docker") {
    return ["HTTP/API 可管理", "需 Docker 平台处理", "非本机宿主"];
  }
  if (instance.type === "nas") {
    return ["HTTP/API 可管理", "需 NAS 平台处理", "非本机宿主"];
  }
  return ["HTTP/API 可管理", "需目标机器处理", "非本机宿主"];
}
