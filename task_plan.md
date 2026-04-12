# task_plan

## 目标
把 openclaw-manager 从“App 顶层全量状态 hook + tab 切换刷新”重构为“tab 级懒创建 + 按页拉数据”，在保留现有页面/服务边界的前提下，显著降低首次可点击时间与切页卡顿。

## 阶段
- [in_progress] Phase 1: 读现状并确定最小重构切面
- [pending] Phase 2: 下沉各 tab 状态到 tab 容器 / 页面级
- [pending] Phase 3: 清理 App 顶层预加载与刷新耦合
- [pending] Phase 4: 构建验证并准备现场验收

## 约束
- 保留现有页面组件与服务层边界
- 优先做最小可落地重构，不同时扩功能
- 每轮改动后必须构建验证

## 风险
- AppContent / 页面 props 连接较多，容易出现类型回归
- useTabRefresh 现有机制可能要同步收敛
