import type { AppInstance, InstallGuide } from "../types/core";
import { isLocalInstance } from "../lib/instanceCapabilities";
import { dispatchDetachedLocalCommand } from "./commandService";
import { dispatchToInstance, readFromInstance } from "./instanceCommandService";

const NO_INSTANCE_INSTALL_GUIDE_MESSAGE = "请先选择要操作的实例，安装引导页不再默认回退到本机 local。";

const DOCKER_COMPOSE_TEMPLATE = `services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./openclaw/config:/root/.openclaw
      - ./openclaw/workspace:/workspace
      - ./openclaw/data:/data
    command: ["openclaw", "gateway", "start"]`;

const DOCKER_RUN_TEMPLATE = `docker run -d \
  --name openclaw \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$PWD/openclaw/config:/root/.openclaw" \
  -v "$PWD/openclaw/workspace:/workspace" \
  -v "$PWD/openclaw/data:/data" \
  ghcr.io/openclaw/openclaw:latest \
  openclaw gateway start`;

const NAS_CHECKLIST = `NAS 部署建议：
1. 映射配置目录到持久卷（如 /root/.openclaw）
2. 映射 workspace 到独立持久卷
3. 映射 data / logs 到可备份位置
4. 若容器网络受限，优先显式映射 3000 端口
5. 先在 NAS 面板里确认卷权限，再连接 manager`;

export function getInstallGuide(instance?: AppInstance): InstallGuide {
  if (instance?.type === "docker") {
    return {
      title: "Docker 部署引导",
      summary: "Docker 实例优先提供 compose / run 模板、持久卷说明与接入步骤，不伪装成本地一键安装。",
      steps: [
        "先在目标机器确认 Docker / Docker Compose 可用。",
        "准备配置、workspace、data 三类持久卷目录，再映射端口。",
        "启动后在容器内或宿主机上确认 gateway 已监听，再回 manager 接入。",
        "接入后用 manager 做连接、模型、备份和状态管理。",
      ],
      notes: [
        "Docker 更适合模板化部署与卷映射，不适合直接走 npm 全局安装。",
      ],
      templates: [
        {
          label: "docker-compose.yml 模板",
          description: "适合 VPS / Linux / Docker Desktop；先改卷路径和端口。",
          content: DOCKER_COMPOSE_TEMPLATE,
        },
        {
          label: "docker run 命令",
          description: "适合快速验证；正式环境仍建议用 compose 管理。",
          content: DOCKER_RUN_TEMPLATE,
        },
      ],
    };
  }

  if (instance?.type === "nas") {
    return {
      title: "NAS 部署引导",
      summary: "NAS 实例优先提供挂载检查清单、容器参数建议与接入步骤。",
      steps: [
        "先在群晖 / 威联通面板里准备容器运行环境。",
        "确认配置目录、workspace、data / logs 目录都已映射到持久化存储。",
        "显式开放并映射 Gateway 端口，避免仅容器内可见。",
        "部署完成后回 manager 添加该 NAS 实例并验证连接。",
      ],
      notes: [
        "NAS 更关键的是目录权限、挂载路径和端口映射，而不是 CLI 本地安装。",
      ],
      templates: [
        {
          label: "NAS 挂载检查清单",
          description: "适合群晖 / 威联通手工部署前自查。",
          content: NAS_CHECKLIST,
        },
        {
          label: "docker-compose.yml 模板",
          description: "很多 NAS 也支持 compose，可按卷路径改写后使用。",
          content: DOCKER_COMPOSE_TEMPLATE,
        },
      ],
    };
  }

  if (instance?.type === "remote") {
    return {
      title: "远端部署引导",
      summary: "远端实例当前优先提供部署引导与模板复制入口，而不是假装一键远程安装。",
      steps: [
        "先判断目标机器更适合 Docker、NAS 容器，还是原生 Node.js 部署。",
        "优先确定 3 类持久化路径：配置目录、workspace 目录、数据目录。",
        "部署完成后先在目标机器运行 openclaw gateway status 或健康检查，确认基础可用。",
        "最后回到 manager 添加该实例并做连接、模型、备份等管理动作。",
      ],
      notes: [
        "当前阶段只提供管理面引导，不把远端自动安装伪装成已完成能力。",
        "若后续要支持真正一键部署，应单独引入受控脚本、环境探测、失败回滚和权限校验。",
      ],
      templates: [
        {
          label: "docker-compose.yml 模板",
          description: "适合 Linux / VPS 远端容器部署；先改卷路径再启动。",
          content: DOCKER_COMPOSE_TEMPLATE,
        },
        {
          label: "docker run 命令",
          description: "适合快速验证；正式环境仍建议用 compose 管理。",
          content: DOCKER_RUN_TEMPLATE,
        },
        {
          label: "NAS 挂载检查清单",
          description: "如果远端其实是 NAS，可直接按此清单核对。",
          content: NAS_CHECKLIST,
        },
      ],
    };
  }

  return {
    title: "本地安装 / 修复引导",
    summary: "本机可直接尝试检查与安装；失败时再退回官方安装流程。",
    steps: [
      "先运行 openclaw --version 确认是否已安装。",
      "若未安装，使用 npm install -g openclaw 完成 CLI 安装。",
      "安装后运行 openclaw setup 或 openclaw gateway status，确认运行基础。",
      "如需控制台 UI，继续运行 openclaw dashboard 或在管理器中刷新本机实例状态。",
    ],
    notes: ["本地实例更适合先做“检查 / 安装引导 / 修复”闭环。"],
    templates: [
      {
        label: "本地安装命令",
        description: "仅适用于本机实例。",
        content: "npm install -g openclaw",
      },
    ],
  };
}

export async function checkOpenClawInstalled(instance?: AppInstance) {
  if (!instance) {
    return { success: false, output: "", error: NO_INSTANCE_INSTALL_GUIDE_MESSAGE };
  }
  return readFromInstance(instance, "openclaw --version");
}

export async function installOpenClaw(instance?: AppInstance) {
  if (!instance) {
    throw new Error(NO_INSTANCE_INSTALL_GUIDE_MESSAGE);
  }

  if (instance.type === "wsl") {
    return dispatchToInstance(instance, "npm install -g openclaw");
  }

  if (!isLocalInstance(instance)) {
    throw new Error("当前仅支持本机实例自动安装；Docker / NAS / 远端实例请使用对应部署引导。");
  }

  return dispatchDetachedLocalCommand("npm install -g openclaw");
}
