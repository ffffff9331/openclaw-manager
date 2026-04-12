# openclaw-manager 架构审计（持续更新）

## 核心标准

openclaw-manager 必须是一个**独立管理助手 App**，而不是 OpenClaw 的附属前端。

### 必须满足
- App 独立启动、独立存活、独立退出
- App 通过读取文件、执行外部命令、读取日志/状态来管理 OpenClaw
- OpenClaw / Gateway 的重启、停止、崩溃，不应决定 App 的生命周期
- UI 只负责把后端结果翻译成人类可读的控制界面
- 高风险控制动作必须经过统一、可审计的控制适配层

### 不应出现
- App 与 OpenClaw / Gateway 共命、共进程边界
- 页面各处自己拼接危险控制命令
- 连接状态决定整个 App 是否还能显示
- 一个 service 同时承担多种不相关职责
- 历史备份文件、废弃路径、未收口试验代码长期堆积

## 当前审计结论

### 已识别问题
1. Gateway 生命周期控制曾直接依赖 `openclaw gateway restart`，在 macOS launchd 路径下存在 wait-for-caller-exit 语义，不适合 App 内嵌调用。
2. 频道配置保存/开关切换曾绕过 Gateway 控制层，直接调用危险重启命令。
3. 本地实例通信模型仍偏向“命令代理”，后续需要继续抽象成更清晰的外部控制语义。
4. service 层曾出现职责过胖、控制路径分散、命名与实际职责不完全一致的问题。
5. 仓库内曾保留 `App.tsx.bak` / `App.tsx.backup-173707` 这类屎山征兆文件。

### 已完成修复
1. 引入 `src/services/instanceCommandService.ts` 作为统一实例命令适配层。
2. `channelService.restartGateway()` 已统一改为复用 `gatewayService.controlGateway("restart")`。
3. 引入 `src/services/channelRuntimeService.ts`，从 `useChatChannels` 中抽离“频道保存后触发运行时变更”的语义。
4. 将 `systemService.ts` 拆分为：
   - `systemService.ts`（系统信息 / 日志 / 策略）
   - `managerUpdateService.ts`（管理器更新检查）
   - `localSystemService.ts`（本地系统动作）
   - `versionService.ts`（纯版本比较逻辑）
5. 清理 Tauri 后端未使用的危险残留重启代码。
6. 清理历史备份文件，减少主路径噪音。

## 第二轮结构审计补充

### 新发现的问题
1. `src/lib/apiClient.ts` 命名与语义不一致：
   - 名字像纯 API/HTTP 客户端
   - 实际却同时承担“远端 HTTP 请求 + 本地命令 fallback”
   - 建议后续更名为更准确的 `instanceTransport` / `instanceRequestRouter` 之类，避免误导维护者
2. `AppInstance.type` 之前包含 `local | remote | docker | nas`，但实际控制逻辑几乎只区分 `local` 与 `非 local`
   - `docker` / `nas` 属于占位概念，未形成真实策略分支
   - 已先收敛回更简单的 `local | remote`，减少伪复杂度扩散
3. Zustand store 基础还算稳，但实例持久化逻辑仍全部塞在 `instanceService.ts`
   - 既做 localStorage 持久化
   - 又做 URL 校验
   - 又做默认实例工厂
   - 这是下一轮可拆点

## 后续重构方向
1. 继续收敛“本地实例 = 命令代理”的语义问题，形成更明确的控制边界。
2. 为高风险命令建立统一控制动作层，禁止页面/业务 hook 直接拼接生命周期命令。
3. 继续拆分 `channelService` / `modelService` 中混合的配置读写、运行时控制、状态查询职责。
4. 重命名/重构 `apiClient.ts`，让“传输层”和“实例控制语义”更清晰。
5. 收敛 `AppInstance.type` 的伪复杂度，去掉未形成真实行为差异的类型或补齐其策略。
6. 为 App 增加更清晰的架构文档和模块边界说明，避免再次长成屎山。
