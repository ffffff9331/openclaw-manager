import { dispatchDetachedLocalCommand } from "./commandService";
import { isWindows, isMacOS } from "../lib/platform";

export interface NodeJsStatus {
  installed: boolean;
  version?: string;
  npmVersion?: string;
}

export async function checkNodeJs(): Promise<NodeJsStatus> {
  try {
    const nodeResult = await dispatchDetachedLocalCommand("node --version");
    const npmResult = await dispatchDetachedLocalCommand("npm --version");

    if (nodeResult.success && npmResult.success) {
      const nodeVersion = nodeResult.output.trim();
      const npmVersion = npmResult.output.trim();
      
      // 检查版本是否 >= 18
      const majorVersion = parseInt(nodeVersion.replace(/^v/, "").split(".")[0]);
      
      return {
        installed: majorVersion >= 18,
        version: nodeVersion,
        npmVersion: npmVersion,
      };
    }

    return { installed: false };
  } catch {
    return { installed: false };
  }
}

export function getNodeJsDownloadUrl(): string {
  if (isWindows()) {
    return "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi";
  }
  if (isMacOS()) {
    return "https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg";
  }
  return "https://nodejs.org/en/download/";
}

export function getNodeJsInstallInstructions(): string[] {
  if (isWindows()) {
    return [
      "1. 下载 Node.js 安装包",
      "2. 双击运行安装程序",
      "3. 按照向导完成安装",
      "4. 重启 openclaw manager",
    ];
  }
  
  if (isMacOS()) {
    return [
      "方法 1 - 使用 Homebrew（推荐）：",
      "  brew install node",
      "",
      "方法 2 - 下载安装包：",
      "  1. 下载 Node.js 安装包",
      "  2. 双击 .pkg 文件安装",
      "  3. 重启 openclaw manager",
    ];
  }

  return [
    "Linux 安装方法：",
    "  # Ubuntu/Debian",
    "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
    "  sudo apt-get install -y nodejs",
    "",
    "  # CentOS/RHEL",
    "  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -",
    "  sudo yum install -y nodejs",
  ];
}
