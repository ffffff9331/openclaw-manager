# 一键安装功能实现报告

## ✅ 已完成

### 1. 安装服务增强
**文件：** `src/services/openclawInstallService.ts`

新增功能：
- `checkOpenClawInstalled()` - 检查是否已安装
- `installOpenClaw()` - 执行安装命令
- `startOpenClawGateway()` - 启动 Gateway

### 2. 自动安装 Hook
**文件：** `src/hooks/useAutoInstall.ts`

功能：
- 检查安装状态
- 自动安装流程
- 启动 Gateway
- 状态管理和错误处理

### 3. 自动安装弹窗组件
**文件：** `src/components/AutoInstallModal.tsx`

功能：
- 显示安装进度
- 实时输出日志
- 前置要求提示
- 安装步骤说明

---

## 🎯 使用流程

### 用户操作流程
1. 打开 openclaw manager
2. 点击"添加实例"或"自动安装"
3. 选择安装目标（本机/WSL/远程）
4. 点击"开始安装"
5. 等待安装完成
6. 自动启动 Gateway
7. 实例自动添加到列表

### 技术流程
```
用户点击安装
    ↓
检查 Node.js 环境
    ↓
执行: npm install -g openclaw@latest
    ↓
验证安装成功
    ↓
执行: openclaw gateway start
    ↓
检测实例并添加
    ↓
完成
```

---

## 📋 前置要求

### 必需
- ✅ Node.js 18+ 已安装
- ✅ npm 可用
- ✅ 网络连接正常

### 可选
- Docker（用于容器部署）
- WSL2（用于 Windows WSL 部署）

---

## 🔧 集成到 UI

### 方案 A：在 Overview 页面添加按钮
```tsx
// src/pages/OverviewPage.tsx
import { AutoInstallModal } from "../components/AutoInstallModal";

// 添加状态
const [showAutoInstall, setShowAutoInstall] = useState(false);

// 添加按钮
<button onClick={() => setShowAutoInstall(true)}>
  一键安装 OpenClaw
</button>

// 添加弹窗
<AutoInstallModal
  open={showAutoInstall}
  currentInstance={currentInstance}
  onClose={() => setShowAutoInstall(false)}
  onSuccess={() => {
    // 刷新实例列表
    onRefreshRuntime?.();
  }}
/>
```

### 方案 B：在 Settings 页面添加
在设置页面的"高级"或"系统"部分添加安装选项

### 方案 C：首次启动引导
检测到没有实例时，自动弹出安装向导

---

## ⚠️ 限制和注意事项

### 当前限制
1. **依赖 npm 全局安装**
   - 需要 OpenClaw 发布到 npm
   - 或者修改为从 GitHub 安装

2. **需要 Node.js 环境**
   - 用户必须预先安装 Node.js
   - 无法在纯净系统上一键完成

3. **权限问题**
   - 全局安装可能需要 sudo/管理员权限
   - Windows 可能需要以管理员身份运行

### 解决方案

#### 短期方案（当前实现）
```bash
# 假设 OpenClaw 已发布到 npm
npm install -g openclaw@latest
```

#### 中期方案（推荐）
```bash
# 从 GitHub 安装
npm install -g https://github.com/openclaw/openclaw.git
```

#### 长期方案（最佳）
```bash
# 提供官方安装脚本
curl -fsSL https://openclaw.ai/install.sh | sh
```

---

## 🚀 下一步

### 立即可做
1. ✅ 在 Overview 页面集成 AutoInstallModal
2. ✅ 添加"一键安装"按钮
3. ✅ 测试安装流程

### 需要配合
1. ⚠️ OpenClaw 发布到 npm（或提供安装脚本）
2. ⚠️ 提供预构建的二进制文件
3. ⚠️ Docker 镜像发布

---

## 📝 代码示例

### 完整集成示例
```tsx
// src/pages/OverviewPage.tsx
import { useState } from "react";
import { AutoInstallModal } from "../components/AutoInstallModal";

export function OverviewPage(props) {
  const [showAutoInstall, setShowAutoInstall] = useState(false);

  return (
    <div>
      {/* 现有内容 */}
      
      {/* 没有实例时显示安装提示 */}
      {props.instances.length === 0 && (
        <div className="empty-state">
          <h3>欢迎使用 OpenClaw Manager</h3>
          <p>开始前需要安装 OpenClaw</p>
          <button onClick={() => setShowAutoInstall(true)}>
            一键安装 OpenClaw
          </button>
        </div>
      )}

      {/* 自动安装弹窗 */}
      <AutoInstallModal
        open={showAutoInstall}
        currentInstance={props.currentInstance}
        onClose={() => setShowAutoInstall(false)}
        onSuccess={() => {
          props.onRefreshRuntime?.();
          props.onDetectInstances?.();
        }}
      />
    </div>
  );
}
```

---

## ✅ 总结

**已实现：**
- ✅ 安装服务 API
- ✅ 自动安装 Hook
- ✅ 安装 UI 组件
- ✅ 完整的安装流程

**待集成：**
- ⏳ 在 UI 中添加入口
- ⏳ 首次启动引导
- ⏳ 错误处理优化

**待配合：**
- ⚠️ OpenClaw npm 包发布
- ⚠️ 或提供安装脚本

**当前状态：**
代码已完成，可以立即集成到 UI。只要 OpenClaw 提供了安装方式（npm/脚本/二进制），就可以实现真正的"一键安装"。

---

**创建时间：** 2026-04-28 13:35
**状态：** ✅ 代码完成，待 UI 集成
