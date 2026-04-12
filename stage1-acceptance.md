# openclaw manager v2 阶段一验收记录

日期：2026-04-02
状态：待人工执行盖章（代码与文档收口完成；正式完成待人工实测）

## 阶段一目标
- 减少 `App.tsx` 杂糅
- 打通“当前实例”主线
- 收紧页面 / 状态 / 服务边界
- 建立可持续收敛的审计记录与回归节奏

## 已完成项

### 1. 当前实例主线已基本打通
- Gateway 控制统一回到 `openclaw gateway {action}` 主线，不再本地偷偷走 `launchctl`
- Tasks 内建“重启 Gateway”已从裸字符串命令升级为 `action` 驱动，并走统一运行时服务入口
- 模型 / 系统 / 渠道 / 任务 等主要状态 hook 已围绕 `currentInstance` 工作，不再默认暗绑本机路径或本机命令语义
- `useInstanceSelection.ts` 已把实例列表读取、当前实例解析、实例切换、新增实例弹窗状态、创建实例动作从 `App.tsx` 下沉
- `allowLanAccess` 已从持久化设置接入 `AddInstanceModal -> validateInstanceBaseUrl(...)` 校验链，新增远端实例时会真实约束允许的地址范围

### 2. 页面层已明显做薄
- `ChatPage` 已拆出 `ChannelConfigModal`
- `ModelsPage` 已拆出 `ModelFormModal`，并继续拆出 `ModelProviderSection` / `ModelCard`
- `AddInstanceModal` 已独立组件化
- `SettingsPage` 已拆出 `UninstallConfirmModal`
- `TasksPage` 的动作链已从页面触发补齐到状态 / 运行时层
- `App.tsx` 已收敛为装配壳，页面分发与 page props 编排下沉到 `AppContent.tsx`
- `AppContent.tsx` 已从“边分发边逐项拼 props”收成“先预组装 page props，再按 tab 分发”
- `GatewayPage / DoctorPage / AppLogsPage / TasksPage / ModelsPage / SettingsPage` 已继续统一到“页面接收单块状态”的接口风格，减少编排层手工摊 props

### 3. hook / 服务边界已更清晰
- 任务相关类型已从页面层上提到 `types/core.ts`
- 渠道配置类型已统一到 `types/core.ts`
- 重复命令封装已删除，减少无意义别名
- `useSystemState` 已与 `useSystemActions` 分仓：读取与动作不再混在同一个 hook
- `useChatChannels` 已改成 `channelHandlers` 分发表驱动，加载/保存元信息集中管理
- `localSystemService` 已切细为 `localShellService + openclawInstallService`
- 构建已多轮回归通过，重构不再停留在纸面

## 当前验收判断
阶段一的核心代码目标已经达到：
- `App.tsx` 已回到较薄的总装配壳，实例入口编排也已下沉到 `useInstanceSelection`
- 当前实例主线已经从“局部失真”收敛到“基本一致”
- 页面层、hook 层、服务层的职责边界明显比初始状态清楚
- 最近几轮改动都能以 `npm run build` 回归兜底，说明收口已从纸面判断变成可验证结果

因此，本阶段当前最准确的判断不是“全部正式完成”，而是：

> **阶段一的代码与文档收口已完成；阶段一含真实交互与重启恢复验证的正式完成，仍待人工实测确认。**

## 当前已通过的部分
- [x] 结构收口
- [x] 构建回归
- [x] 验收文档补齐

## 当前未完成的部分
- [ ] 页面级人工点按回归
- [ ] 重启恢复最终实测
- [ ] 基于人工实测结果改写最终状态为“正式完成”

## 仍存在但不阻塞代码与文档收口的尾项
- `AppContent.tsx` 已收成页面编排壳，但后续仍可继续评估是否拆出更明确的 orchestrator / page composer
- `useChatChannels.ts` / `channelService.ts` 仍可继续往更数据驱动的 spec 化推进，但已不属于阶段一必须项
- 宿主机动作与远端实例动作的边界已显著改善，后续仍可继续做更细的 runtime / orchestration 层提炼

## 阶段二建议入口
优先顺序：
1. `useChatChannels.ts` / `channelService.ts` 配置 spec 化继续收敛
2. `AppContent.tsx` / orchestrator 编排层继续提纯
3. 服务层进一步分离“宿主机动作”与“实例运维动作”

## 本阶段可见结果
- `App.tsx`: 102 行
- `AppContent.tsx`: 194 行
- `ModelsPage`: 153 行（由 286 行收缩）
- `SettingsPage`: 134 行，并已拆出 `UninstallConfirmModal`（32 行）
- 构建状态：`npm run build` 通过

## 结论
阶段一已经不再需要靠“继续找旧残留”维持推进感；当前代码、构建与文档三者已经基本对齐，**代码与文档收口已经成立**。目前更准确的表述是：**阶段一验收口径已基本统一，正式完成仍待人工点按回归与重启恢复验证盖章。**
