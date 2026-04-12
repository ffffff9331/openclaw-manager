# findings

- 当前主痛点不是单个页面渲染，而是 App 顶层过早实例化多个业务 hook，并曾伴随启动自跑/切页刷新。
- 已确认 AppContent 不是所有页面同时渲染；问题更接近“状态容器太早建立 + 数据加载入口分散”。
- 更合适的方向是 tab 级容器或页面级 hook，下沉 models/skills/tasks/system/chat 状态所有权。
