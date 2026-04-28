import { useState, useMemo } from "react";
import { useAutoInstall } from "../hooks/useAutoInstall";
import { getNodeJsDownloadUrl, getNodeJsInstallInstructions } from "../services/nodeJsCheckService";
import { getDockerInstallInstructions, type InstallTarget } from "../services/dockerInstallService";
import type { AppInstance } from "../types/core";

interface AutoInstallModalProps {
  open: boolean;
  currentInstance?: AppInstance;
  onClose: () => void;
  onSuccess: () => void;
}

export function AutoInstallModal({ open, currentInstance, onClose, onSuccess }: AutoInstallModalProps) {
  const [installTarget, setInstallTarget] = useState<InstallTarget>("local");
  const [dockerWorkDir, setDockerWorkDir] = useState("~/openclaw-docker");

  const targetInstance = useMemo(() => {
    if (installTarget === "local") {
      return currentInstance || { id: "temp-local", name: "本地", type: "local" as const, baseUrl: "http://localhost:18789", createdAt: Date.now() };
    }
    if (installTarget === "wsl") {
      return { id: "temp-wsl", name: "WSL2", type: "wsl" as const, baseUrl: "http://localhost:18789", createdAt: Date.now() };
    }
    return undefined;
  }, [installTarget, currentInstance]);

  const { installing, installStatus, installOutput, nodeJsStatus, dockerStatus, checkingEnv, checkAndInstall } = useAutoInstall({
    currentInstance: targetInstance,
    installTarget,
    dockerWorkDir,
    onSuccess: () => {
      onSuccess();
      setTimeout(onClose, 2000);
    },
    onError: (error) => {
      console.error("安装失败:", error);
    },
  });

  if (!open) return null;

  const envReady = installTarget === "docker" 
    ? (dockerStatus?.docker && dockerStatus?.compose)
    : nodeJsStatus?.installed;

  const downloadUrl = getNodeJsDownloadUrl();
  const nodeInstructions = getNodeJsInstallInstructions();
  const dockerInstructions = getDockerInstallInstructions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auto-install-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>自动安装 OpenClaw</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 安装目标选择 */}
          <div className="install-target-selector">
            <h3>选择安装方式：</h3>
            <div className="target-options">
              <label className={`target-option ${installTarget === "local" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="installTarget"
                  value="local"
                  checked={installTarget === "local"}
                  onChange={(e) => setInstallTarget(e.target.value as InstallTarget)}
                  disabled={installing}
                />
                <div className="option-content">
                  <strong>本地安装</strong>
                  <span>直接在本机安装 OpenClaw（推荐）</span>
                  <span className="requirement">需要: Node.js 18+</span>
                </div>
              </label>

              <label className={`target-option ${installTarget === "wsl" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="installTarget"
                  value="wsl"
                  checked={installTarget === "wsl"}
                  onChange={(e) => setInstallTarget(e.target.value as InstallTarget)}
                  disabled={installing}
                />
                <div className="option-content">
                  <strong>WSL2 安装</strong>
                  <span>在 Windows WSL2 环境中安装</span>
                  <span className="requirement">需要: WSL2 + Node.js 18+</span>
                </div>
              </label>

              <label className={`target-option ${installTarget === "docker" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="installTarget"
                  value="docker"
                  checked={installTarget === "docker"}
                  onChange={(e) => setInstallTarget(e.target.value as InstallTarget)}
                  disabled={installing}
                />
                <div className="option-content">
                  <strong>Docker 安装</strong>
                  <span>使用 Docker 容器运行（隔离环境）</span>
                  <span className="requirement">需要: Docker + Docker Compose</span>
                </div>
              </label>
            </div>
          </div>

          {/* Docker 工作目录 */}
          {installTarget === "docker" && (
            <div className="docker-workdir">
              <label>
                <strong>工作目录：</strong>
                <input
                  type="text"
                  value={dockerWorkDir}
                  onChange={(e) => setDockerWorkDir(e.target.value)}
                  disabled={installing}
                  placeholder="~/openclaw-docker"
                />
              </label>
              <p className="hint">配置和数据将保存在此目录</p>
            </div>
          )}

          {/* 环境检查 */}
          <div className={`environment-check ${envReady ? "success" : "warning"}`}>
            <h3>环境检查</h3>
            {checkingEnv ? (
              <p>检查中...</p>
            ) : installTarget === "docker" ? (
              dockerStatus?.docker && dockerStatus?.compose ? (
                <div className="env-success">
                  <p>✅ Docker 已安装</p>
                  <p>✅ Docker Compose 已安装</p>
                </div>
              ) : (
                <div className="env-warning">
                  <p>❌ Docker 环境未就绪</p>
                  <div className="install-instructions">
                    <h4>安装 Docker：</h4>
                    <pre>{dockerInstructions.join("\n")}</pre>
                  </div>
                </div>
              )
            ) : nodeJsStatus?.installed ? (
              <div className="env-success">
                <p>✅ Node.js {nodeJsStatus.version}</p>
                <p>✅ npm {nodeJsStatus.npmVersion}</p>
              </div>
            ) : (
              <div className="env-warning">
                <p>❌ Node.js 未安装或版本低于 18</p>
                <div className="install-instructions">
                  <h4>安装 Node.js：</h4>
                  <pre>{nodeInstructions.join("\n")}</pre>
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="download-link">
                    下载 Node.js
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* 安装状态 */}
          {installStatus && (
            <div className="install-status">
              <p>{installStatus}</p>
            </div>
          )}

          {/* 安装输出 */}
          {installOutput && (
            <div className="install-output">
              <pre>{installOutput}</pre>
            </div>
          )}

          {/* 安装步骤说明 */}
          {envReady && (
            <div className="install-steps">
              <h3>安装步骤：</h3>
              {installTarget === "docker" ? (
                <ol>
                  <li>创建工作目录和子目录</li>
                  <li>生成 docker-compose.yml 配置</li>
                  <li>拉取 OpenClaw Docker 镜像</li>
                  <li>启动容器</li>
                </ol>
              ) : (
                <ol>
                  <li>检查 Node.js 和 npm 环境</li>
                  <li>执行 npm install -g openclaw@latest</li>
                  <li>启动 OpenClaw Gateway</li>
                  <li>验证安装成功</li>
                </ol>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} disabled={installing}>
            取消
          </button>
          <button
            onClick={checkAndInstall}
            disabled={installing || !envReady || (installTarget === "docker" && !dockerWorkDir)}
            className="primary"
          >
            {installing ? "安装中..." : envReady ? "开始安装" : "请先安装依赖"}
          </button>
        </div>
      </div>
    </div>
  );
}
