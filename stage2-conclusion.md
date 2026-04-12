# openclaw-manager v2 阶段二当前结论（人工验收前）

日期：2026-04-04
状态：可用于人工回归前汇报

---

## 一、结论一句话

> **阶段 1 基本完成、待正式验收；阶段 2 首批核心管理能力开发已基本成形，web preview 管理面回归证据已基本补齐，下一步是真实 Tauri 宿主环境人工回归。**

---

## 二、阶段二当前已完成开发的代表项

### 1. 安装 / 部署
- `local`：安装检查 + 本地安装入口
- `remote`：Docker / NAS 部署引导
- 支持模板复制：
  - `docker-compose.yml`
  - `docker run`
  - NAS 挂载检查清单

### 2. 备份
- 备份预览
- 创建备份
- 校验备份
- 还原备份入口

### 3. 技能管理
- 技能列表
- 启用 / 禁用
- 打开目录入口（本地）

### 4. 模型管理增强
- 一键添加预设
- 单项连通性测试
- 批量连通性测试
- 可持久化顺序调整（上移 / 下移）
- 设置默认模型
- 新增 / 编辑 / 删除自定义模型

### 5. Gateway / LaunchAgent 管理
- Gateway 状态读取
- 启停 / 重启动作投递
- LaunchAgent 安装 / 加载 / 卸载 / 移除入口
- 最近状态 / 日志 / 错误归因 / 历史 / duration 展示

### 6. 诊断与任务
- doctor dispatch + result retrieval 最小闭环
- cron 第一版维护闭环
- App 日志查看

---

## 三、边界口径（必须保持）

### manager 该做的
- 管理面
- 适配层
- 调用层
- 引导层
- 状态展示
- 结果读取
- 模板 / 配置 / 入口管理

### openclaw 本体该做的
- agent runtime
- 核心执行逻辑
- 核心协议内部细节
- 运行时状态机
- 真正的安装执行主体 / 模型执行链 / 技能执行链

### 当前阶段二中主动不做的越界项
- 远端自动安装
- manager 内直接接管模型真实执行链
- manager 内直接承载技能执行逻辑
- manager 自动替本体重启运行时

---

## 四、当前已完成的 preview 管理面回归结论
- 已在 web preview 下补证：首页初始化、`SettingsPage`、`ModelsPage`、`SkillsPage`、`GatewayPage`、`DoctorPage`、`AppLogsPage`、`TasksPage`
- 当前 preview 结论不是“真实桌面动作已通过”，而是：核心管理面页面已基本可展示，且桌面宿主专属动作已从 `invoke undefined` 类 JS 崩溃改善为明确的桌面限定提示或合理空态
- `SkillsPage`：已从宿主桥崩溃改善为明确提示 `openclaw skills list` 仅在 Tauri 桌面环境可用
- `GatewayPage`：已确认标题、状态区、LaunchAgent 区和“发起动作 → 轮询状态 / 日志”语义均可见
- `DoctorPage`：已确认“一键诊断 / 刷新诊断结果 / 快速概览 / 待检测”区块可见
- `AppLogsPage`：已确认会降级为“当前是 web preview；App 日志读取仅在 Tauri 桌面环境可用”
- `TasksPage`：已确认调度器状态、最近运行记录、快捷指令区与高级字段边界提示均可见，并在 preview 下对 `openclaw cron status --json` 给出明确桌面限定提示

## 五、当前仍待真实宿主环境人工确认的点
- 各页面围绕 current instance 的切换一致性
- 远端安装引导模板复制体验
- 备份还原入口的人工操作结果确认
- 技能启用 / 禁用的实际回显
- 模型连通性测试在真实 provider 上的表现
- 模型顺序调整后的实际配置顺序回显
- Gateway / LaunchAgent 管理动作的手动点按验证
- doctor 的真实执行与结果读取
- cron 第一版的真实创建 / 编辑 / 删除 / 执行链
- App 日志在真实桌面宿主环境下的读取结果

---

## 五、仍未正式宣布完成的内容
- 阶段一正式验收通过
- 阶段二人工回归通过
- 模型拖拽交互体验打磨
- 阶段三 Docker/NAS/Web 化支撑整体进入验收
- 阶段四实例发现与接入增强

---

## 七、建议的下一步
1. 停止继续在 web preview 下补证，转入真实 Tauri 宿主环境人工点按回归
2. 按 `stage2-manual-test-quick.md` 先跑一轮最小手测，再把结果回填到 `stage2-manual-test-run.md`
3. 优先验证：`SettingsPage` → `ModelsPage` → `SkillsPage` → `GatewayPage` → `DoctorPage` → `TasksPage` → `AppLogsPage`
4. 手测时每页只记 3 件事：动作有没有发出去、页面有没有结果区/状态区回显、提示文案是否动作化且不越界
5. 根据真实桌面回归结果决定：
   - 直接宣布“阶段二当前批次具备人工通过条件”
   - 或先修小范围回归问题

---

## 七、汇报禁忌
- 不把“已完成开发”说成“已正式完成”
- 不把“远端部署引导”说成“远端自动安装”
- 不把“排序能力已落地”误说成“拖拽交互已完成”
- 不把 manager 的引导/探测/配置能力夸大为 openclaw 本体能力
