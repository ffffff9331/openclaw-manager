import { dispatchDetachedLocalCommand } from "./commandService";
import { isWindows } from "../lib/platform";

export type InstallTarget = "local" | "wsl" | "docker";

export interface DockerInstallResult {
  success: boolean;
  output: string;
  error?: string;
}

async function checkDockerInstalled(): Promise<boolean> {
  try {
    const result = await dispatchDetachedLocalCommand("docker --version");
    return result.success;
  } catch {
    return false;
  }
}

async function checkDockerComposeInstalled(): Promise<boolean> {
  try {
    const result = await dispatchDetachedLocalCommand("docker compose version");
    return result.success;
  } catch {
    return false;
  }
}

export async function checkDockerEnvironment(): Promise<{ docker: boolean; compose: boolean }> {
  const [docker, compose] = await Promise.all([
    checkDockerInstalled(),
    checkDockerComposeInstalled(),
  ]);
  return { docker, compose };
}

export async function installOpenClawWithDocker(workDir: string): Promise<DockerInstallResult> {
  // 1. 创建 docker-compose.yml
  const composeContent = `version: '3.8'

services:
  openclaw:
    image: openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "18789:18789"
    volumes:
      - ./openclaw-data:/root/.openclaw
      - ./openclaw-workspace:/root/.openclaw/workspace
    environment:
      - TZ=Asia/Shanghai
      - OPENCLAW_GATEWAY_PORT=18789
      - OPENCLAW_GATEWAY_HOST=0.0.0.0
`;

  try {
    // 2. 创建工作目录
    const mkdirCmd = isWindows() 
      ? `mkdir "${workDir}\\openclaw-data" "${workDir}\\openclaw-workspace" 2>nul`
      : `mkdir -p "${workDir}/openclaw-data" "${workDir}/openclaw-workspace"`;
    
    await dispatchDetachedLocalCommand(mkdirCmd);

    // 3. 写入 docker-compose.yml
    const composeFile = isWindows() 
      ? `${workDir}\\docker-compose.yml`
      : `${workDir}/docker-compose.yml`;
    
    const writeCmd = isWindows()
      ? `echo ${composeContent.replace(/\n/g, "^")} > "${composeFile}"`
      : `cat > "${composeFile}" << 'EOF'\n${composeContent}\nEOF`;
    
    await dispatchDetachedLocalCommand(writeCmd);

    // 4. 启动容器
    const startCmd = `cd "${workDir}" && docker compose up -d`;
    const result = await dispatchDetachedLocalCommand(startCmd);

    if (!result.success) {
      return {
        success: false,
        output: result.output,
        error: result.error || "Docker 启动失败",
      };
    }

    return {
      success: true,
      output: result.output,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getDockerInstallInstructions(): string[] {
  if (isWindows()) {
    return [
      "Windows 安装 Docker：",
      "1. 下载 Docker Desktop for Windows",
      "   https://www.docker.com/products/docker-desktop",
      "2. 运行安装程序",
      "3. 启动 Docker Desktop",
      "4. 等待 Docker 引擎启动完成",
    ];
  }

  return [
    "macOS 安装 Docker：",
    "1. 下载 Docker Desktop for Mac",
    "   https://www.docker.com/products/docker-desktop",
    "2. 拖动到 Applications 文件夹",
    "3. 启动 Docker Desktop",
    "",
    "或使用 Homebrew：",
    "  brew install --cask docker",
  ];
}
