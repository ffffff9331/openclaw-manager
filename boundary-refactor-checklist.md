# openclaw-manager 边界整改清单

日期：2026-04-03
状态：进行中
目标：把 `openclaw-manager` 明确收敛为**独立运行的控制台**，它只负责**发信号、获取结果、展示状态**；不直接参与 OpenClaw / Gateway / cron / install / backup 等被控对象的完整生命周期动作。

---

## 一、边界铁律

### 1. app 只做三件事
- 发信号（dispatch intent）
- 获取结果（read result / poll state）
- 展示状态（render state）

### 2. app 不做的事
- 不直接执行被控对象的完整生命周期动作
- 不等待危险动作完成
- 不与 Gateway / OpenClaw 共命运
- 不因为 Gateway 重启/掉线而退出或白屏

### 3. 判断标准
如果一个实现会让 app 当前宿主：
- 直接执行 `openclaw gateway restart`
- 直接执行 install / uninstall / backup create 主体
- 直接承担 cron 写操作的完整执行过程

那么它就是**越界实现**。

---

## 二、目标分层

### A. 结果读取层（Read Layer）
只读，不改变系统。

目标接口示例：
- `getGatewayStatus()`
- `getGatewayLogs()`
- `getSystemInfo()`
- `getAppLogs()`
- `getCronStatus()`
- `listCronJobs()`
- `listCronRuns()`
- `getModelsConfig()`

要求：
- 可以走文件、HTTP、健康检查、只读命令桥
- 不允许承担危险副作用动作

### B. 意图投递层（Dispatch Layer）
只发信号，立即返回，不等待完成。

目标接口示例：
- `dispatchGatewayStart()`
- `dispatchGatewayStop()`
- `dispatchGatewayRestart()`
- `dispatchCronMutation()`
- `dispatchDoctor()`
- `dispatchInstall()`
- `dispatchBackupCreate()`

要求：
- 返回 `accepted` / `queued` / `rejected`
- 不把执行过程绑定到 app 当前宿主生命周期

### C. 独立执行层（Execution Layer）
负责真正执行副作用动作，但不能与当前 app 宿主共命运。

可选形态：
- helper 进程
- 守护进程 / launch service
- Gateway 自己的控制端点
- 独立 worker

要求：
- 被控对象波动时，不影响 app 存活
- app 只通过 polling / result retrieval 观察执行结果

---

## 三、现状审计结果（按文件）

---

### 1. `src/services/commandService.ts`
当前职责：
- `runOpenClawCommand(command)` → `invoke("run_command")`

现状判断：**严重越界**

原因：
- 当前它是“万能执行器”
- 读、写、控制动作、危险动作都可能通过它落到宿主 shell
- 这让 app 直接扮演了“执行主体”

整改方向：
- 降级为调试桥 / 兼容桥
- 不再作为 Gateway / install / backup / cron mutation 的主路径
- 后续仅允许：
  - 非关键只读命令
  - 开发调试命令
  - 临时兼容 fallback（最终也应清退）

优先级：**P0**

---

### 2. `src/lib/instanceRequestRouter.ts`
当前职责：
- remote：HTTP 请求远端实例
- local：如果有 `command`，就直接 `runOpenClawCommand(command)`

现状判断：**严重越界**

原因：
- local 和 remote 语义完全不一致
- remote 更像“发信号 / 获取结果”
- local 实际是在“直接执行主体”

整改方向：
- local 分支不能再默认落到通用 shell 执行
- local 也必须与 remote 保持一致的语义：
  - 要么走本地只读接口
  - 要么走本地 dispatch 接口
- 彻底禁止把 `instance.type === "local"` 等价成“直接执行 shell”

优先级：**P0**

---

### 3. `src/services/instanceCommandService.ts`
当前职责：
- 把实例命令统一路由到本地 / 远端

现状判断：**严重越界**

原因：
- 名字像“统一实例抽象”
- 但本地实例最终仍落回 `runOpenClawCommand`
- 这使得 local instance = 执行器，remote instance = 结果读取器

整改方向：
- 拆分为两种接口：
  - `requestInstanceRead(...)`
  - `dispatchInstanceAction(...)`
- 禁止继续存在“一个统一命令入口既能读又能写又能控制”的设计

优先级：**P0**

---

### 4. `src/services/gatewayService.ts`
当前职责：
- 读取 gateway status / logs
- 控制 gateway start/stop/restart

现状判断：**核心边界未完成**

#### 已做对的一部分
- 本地 logs 已经走 `read_gateway_logs`
- restart 已尝试改成 `dispatch_gateway_restart`

#### 当前状态
- 当前 helper 的准确定位：**队列式 dispatcher + worker**，不是 daemon
- `scripts/gateway_control.sh` 现在只负责写入 action 请求并触发 worker
- `scripts/gateway_control_worker.sh` 承接真正的 Gateway 生命周期动作主体
- Tauri 当前只负责 detached 投递 dispatcher，不再在主控制桥里直接拼接 launchctl / shell 主体命令
- Gateway 页已能读取并展示 `last-dispatch / last-request / last-result` 最小状态
- LaunchAgent 是否已安装/已加载现已进入 UI 检测链
- LaunchAgent install/load/unload/remove 动作链已接入 App，且最近动作/结果现已进入 Gateway control 状态读取；结果语义已提升为 queued / running / success / failed，并支持按动作读取最近日志、失败摘要、错误归因、恢复提示、duration 与最近历史列表，但仍不承诺当前链路同步完成

#### 仍然不对的部分
- worker 默认仍是一次性 drain 模式；只有额外挂载 `ai.openclaw.gateway-control` LaunchAgent 时才更接近独立执行代理
- 这仍未达到“独立执行层”终态

整改方向：
- `gatewayService` 只保留两类接口：
  - `getGatewayStatus/getGatewayLogs`（读）
  - `dispatchGatewayStart/Stop/Restart`（投递）
- 本地 dispatch 不能直接在当前 app 宿主里执行 restart 主体
- 应改为投递到**独立执行层**

优先级：**P0**

---

### 5. `src/hooks/useGatewayState.ts`
当前职责：
- 控制后刷新
- 轮询 Gateway 状态
- 刷新日志

现状判断：**观察层思路基本正确，发起层依赖仍不干净**

#### 对的地方
- `refreshGatewayAfterAction`
- `pollGatewayAfterRestart`
- 状态 / 日志轮询这条思路正确

#### 当前状态
- 观察层逻辑（刷新/轮询）保留
- `controlGateway` 返回语义已收成“已投递 / 已发起”类消息
- Gateway 页已明确改成“发起动作 → 轮询状态 / 日志”，不再把当前链路执行完成当成前提

整改方向：
- 继续保留观察层逻辑
- 后续若再收口，可把 dispatch 结果进一步结构化成 accepted / queued / failed
- 不再认“restart 是否在当前链路执行完成”

优先级：**P0**

---

### 6. `src-tauri/src/lib.rs`
当前职责：
- 通用 shell 执行桥 `run_command`
- gateway status / control / logs
- doctor
- app logs

现状判断：**当前最大越界集中点**

#### 越界点
- `run_command`：总执行器，越界源头
- `control_gateway`：当前宿主直接参与 Gateway 生命周期控制
- `dispatch_gateway_restart`：虽然名字是 dispatch，但本质仍在当前宿主起 restart 主体

整改方向：
- 把 Rust 层明确拆成：
  - `read_*`：只读接口
  - `dispatch_*`：只投递意图
- `dispatch_gateway_restart` 必须进一步外移：
  - 当前宿主不能直接承担 restart 本体
- 推荐新增专门的“外部执行代理”机制，而不是继续在当前 app 进程树中起 shell

优先级：**P0**

---

### 7. `src/hooks/useSystemState.ts`
当前职责：
- 读 system info
- 跑 doctor
- 读 app logs

现状判断：**已部分收口，结果读取链仍未完整**

#### 较正确
- `loadSystemInfo`
- `loadAppLogs`

#### 已收口部分
- 本地 `runDoctor()` 已改为 detached 投递，不再同步占用 app 当前宿主执行 doctor 主体
- Tasks 页内建的 `openclaw doctor` / `--deep` / `--repair` 快捷命令，已改为同样的后台投递语义

#### 当前状态
- 本地 doctor 已具备最小 `dispatch + result retrieval` 闭环：后台投递后，可通过 Doctor 页“刷新诊断结果”读取最近输出
- Tauri 侧已补 `read_doctor_result`，本地读取源统一为 `/tmp/openclaw-manager-doctor.log`

#### 剩余尾项
- 远端实例当前仍复用通用日志读取语义，尚未拥有独立 doctor 结果读取接口
- 本地 doctor 结果目前读取的是最近日志片段，还没有任务级状态（queued/running/done）结构化元数据

整改方向：
- 继续补远端 doctor result retrieval 语义
- 若后续需要，再把 doctor 结果从“日志片段”升级成“结构化状态 + 输出”

优先级：**P1**

---

### 8. `src/hooks/useSystemActions.ts`
当前职责：
- install / uninstall / backup / verify / openConfigDir / toggle settings / updates

现状判断：**高副作用动作越界严重**

#### 明显越界动作
- install
- uninstall
- backup create
- backup verify

原因：
- 都是高副作用动作
- 都仍由 app 当前宿主直接承担执行链

整改方向：
- 只保留读取类和轻量 UI 类逻辑在当前层
- 高副作用动作全部升级为 dispatch 接口
- app 自己只显示：
  - 已发起
  - 执行中
  - 已完成 / 失败

优先级：**P1**

---

### 9. `src/services/cronService.ts`
当前职责：
- 读取 cron status/list/runs
- 写 cron add/edit/enable/disable/run/rm

现状判断：**读写未分层**

#### 读取类
- `getCronStatus`
- `listCronJobs`
- `listCronRuns`

这些更接近读取层，但当前仍通过命令取 JSON。

#### 写入类
- `createCronJob`
- `editCronJob`
- `setCronJobEnabled`
- `removeCronJob`
- `runCronJobNow`

这些都是动作，不该由 app 当前宿主承担完整执行链。

整改方向：
- 拆成：
  - `readCron*`
  - `dispatchCron*`
- UI 只负责投递与回显结果，不承担 mutation 主体执行

优先级：**P1**

---

### 10. `src/services/modelService.ts`
当前职责：
- 读/写模型配置
- 设置默认模型
- 删除 provider
- 之后重启 Gateway

现状判断：**配置与生命周期控制耦合**

#### 当前状态
- `setDefaultModel()` 已去掉直接 `controlGateway("restart")`
- `deleteModel()` 已去掉直接 `controlGateway("restart")`
- 模型页现改为仅写配置，并提示“按需重载 Gateway”

当前剩余边界尾项：
- 模型配置变更后的 restart/reload 仍缺统一调度入口
- 目前仍靠页面提示人工触发，尚未完全纳入独立 dispatch 编排层

整改方向：
- 模型页只负责配置变化
- 页面提示“需要 Gateway 重载/重启才生效”
- 后续由独立 dispatch 层统一处理 restart/reload 信号

优先级：**P1**

---

## 四、优先级排序

### P0：必须先改
1. `run_command` 降权，不再作为控制总线
2. local instance 不再默认等于“直接执行 shell”
3. Gateway start/stop/restart 改为真正的 dispatch-only
4. app 宿主不再参与 Gateway restart 主体执行

#### P0 当前进展（2026-04-03 14:55）
- [x] 业务层大部分主链已迁到 `read / dispatch` 语义：system / install / backup / gateway / models / cron / manager update / channels
- [x] 本地桥接口已拆出 `read_command / dispatch_command / run_command`
- [x] 本地实例路由已不再默认落到旧 `run_command`，而是按读/动作路径分流
- [x] Gateway 本地控制已强制优先走专用 `control_gateway / dispatch_gateway_restart`，不再因“当前实例是本地对象”而绕回通用 dispatch 路径
- [x] `read_command` 已加只读护栏，`dispatch_command` 已阻止通用 Gateway lifecycle 动作误入
- [x] `run_command` 已缩回兼容桥，新的业务迁移不再以它为主路径
- [x] `read_command` / `dispatch_command` / `run_command` 已拆为独立执行入口，不再共用同一个 `execute_command(...)` 包装层
- [~] Gateway lifecycle 已进一步改为 detached 投递，但仍需验证是否足以切断当前宿主进程树耦合
- [~] install / uninstall / backup create 已开始走 detached 本地投递，高副作用动作正逐步从普通 dispatch 脱离；verify 等结果观察动作保留同步读取/校验链

### P1：第二批改
1. system 高副作用动作（install/uninstall/backup/verify）
2. cron 写操作
3. model 修改后的 restart/reload 耦合（默认模型切换与删除 provider 的自动重启已拆除，现改为按需重载提示）
4. doctor 执行链

### P2：第三批改
1. 读取层统一只读接口化
2. local / remote 完全同语义抽象
3. 逐步淘汰 `run_command` 的业务路径用途

---

## 五、Gateway 专项整改标准（必须满足）

点击 `重启 Gateway` 后，唯一正确流程：

```text
app 发出 restart 信号
→ 立即收到 accepted / queued
→ app 继续活着
→ app 显示“重连中”
→ app 轮询 gateway status / logs
→ Gateway 恢复后更新页面
```

禁止出现：
- app 等待 restart 完成
- app 当前宿主执行 restart 主体
- restart 期间 app 退出 / 白屏 / 闪退

---

## 六、下一步执行建议

### 第一步（当前最重要）
抽出一个真正独立于 app 宿主的 Gateway 控制执行层。

建议方向：
- helper 进程
- launch service 代理
- 独立控制守护进程
- Gateway 自身控制端点

### 第二步
让 `gatewayService` / `useGatewayState` 完全变成：
- dispatch
- poll
- render

### 第三步
按同样模式把：
- system 高副作用动作
- cron mutation
- model 后置 restart

全部改造成“只发信号，不执行主体”。

---

## 七、结论

当前 `openclaw-manager` 最大的问题不是某个按钮 bug，
而是：

> **app 还没有严格实现“独立运行、只发信号、只获取结果”的边界。**

后续所有修复，应以这个清单为准，不再按零散现象补丁推进。
�进。
��
�进。
