import { useState, useCallback, useEffect } from "react";
import type { AppInstance } from "../types/core";
import { checkOpenClawInstalled, installOpenClaw, startOpenClawGateway } from "../services/openclawInstallService";
import { checkNodeJs, type NodeJsStatus } from "../services/nodeJsCheckService";
import { checkDockerEnvironment, installOpenClawWithDocker, type InstallTarget } from "../services/dockerInstallService";

interface UseAutoInstallOptions {
  currentInstance?: AppInstance;
  installTarget: InstallTarget;
  dockerWorkDir?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useAutoInstall({ currentInstance, installTarget, dockerWorkDir, onSuccess, onError }: UseAutoInstallOptions) {
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState("");
  const [installOutput, setInstallOutput] = useState("");
  const [nodeJsStatus, setNodeJsStatus] = useState<NodeJsStatus | null>(null);
  const [dockerStatus, setDockerStatus] = useState<{ docker: boolean; compose: boolean } | null>(null);
  const [checkingEnv, setCheckingEnv] = useState(false);

  const checkEnvironment = useCallback(async () => {
    setCheckingEnv(true);
    try {
      if (installTarget === "docker") {
        const status = await checkDockerEnvironment();
        setDockerStatus(status);
      } else {
        const status = await checkNodeJs();
        setNodeJsStatus(status);
      }
    } finally {
      setCheckingEnv(false);
    }
  }, [installTarget]);

  useEffect(() => {
    void checkEnvironment();
  }, [checkEnvironment]);

  const checkAndInstall = useCallback(async () => {
    // Docker 安装流程
    if (installTarget === "docker") {
      if (!dockerStatus?.docker || !dockerStatus?.compose) {
        onError?.("请先安装 Docker 和 Docker Compose");
        return;
      }

      if (!dockerWorkDir) {
        onError?.("请指定 Docker 工作目录");
        return;
      }

      setInstalling(true);
      setInstallStatus("正在使用 Docker 安装 OpenClaw...");
      setInstallOutput("创建 docker-compose.yml...\n");

      try {
        const result = await installOpenClawWithDocker(dockerWorkDir);

        if (!result.success) {
          setInstallStatus("❌ Docker 安装失败");
          setInstallOutput(prev => `${prev}\n${result.error || result.output}`);
          onError?.(result.error || "安装失败");
          setInstalling(false);
          return;
        }

        setInstallStatus("✅ OpenClaw Docker 容器已启动");
        setInstallOutput(prev => `${prev}\n${result.output}\n\n容器地址: http://localhost:18789`);
        onSuccess?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setInstallStatus(`❌ 错误: ${message}`);
        setInstallOutput(prev => `${prev}\n\n错误: ${message}`);
        onError?.(message);
      } finally {
        setInstalling(false);
      }
      return;
    }

    // npm 安装流程（local/wsl）
    if (!currentInstance) {
      onError?.("请先选择实例");
      return;
    }

    if (!nodeJsStatus?.installed) {
      onError?.("请先安装 Node.js 18+");
      return;
    }

    setInstalling(true);
    setInstallStatus("检查 OpenClaw 安装状态...");
    setInstallOutput("");

    try {
      const { installed, version } = await checkOpenClawInstalled(currentInstance);
      
      if (installed) {
        setInstallStatus(`OpenClaw 已安装（版本：${version}）`);
        setInstallOutput(`检测到 OpenClaw ${version}`);
        
        setInstallStatus("启动 Gateway...");
        const startResult = await startOpenClawGateway(currentInstance);
        
        if (startResult.success) {
          setInstallStatus("✅ OpenClaw 已就绪");
          setInstallOutput(prev => `${prev}\n\nGateway 启动成功`);
          onSuccess?.();
        } else {
          setInstallStatus("⚠️ Gateway 启动失败");
          setInstallOutput(prev => `${prev}\n\n${startResult.error || startResult.output}`);
        }
        
        setInstalling(false);
        return;
      }

      setInstallStatus("正在安装 OpenClaw...");
      setInstallOutput("执行: npm install -g openclaw@latest\n");

      const installResult = await installOpenClaw(currentInstance);

      if (!installResult.success) {
        setInstallStatus("❌ 安装失败");
        setInstallOutput(prev => `${prev}\n${installResult.error || installResult.output}`);
        onError?.(installResult.error || "安装失败");
        setInstalling(false);
        return;
      }

      setInstallOutput(prev => `${prev}\n${installResult.output}`);
      setInstallStatus("安装成功，启动 Gateway...");

      const startResult = await startOpenClawGateway(currentInstance);

      if (startResult.success) {
        setInstallStatus("✅ OpenClaw 安装并启动成功");
        setInstallOutput(prev => `${prev}\n\nGateway 启动成功`);
        onSuccess?.();
      } else {
        setInstallStatus("⚠️ 安装成功，但 Gateway 启动失败");
        setInstallOutput(prev => `${prev}\n\n${startResult.error || startResult.output}`);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setInstallStatus(`❌ 错误: ${message}`);
      setInstallOutput(prev => `${prev}\n\n错误: ${message}`);
      onError?.(message);
    } finally {
      setInstalling(false);
    }
  }, [currentInstance, installTarget, dockerWorkDir, nodeJsStatus, dockerStatus, onSuccess, onError]);

  return {
    installing,
    installStatus,
    installOutput,
    nodeJsStatus,
    dockerStatus,
    checkingEnv,
    checkEnvironment,
    checkAndInstall,
  };
}
