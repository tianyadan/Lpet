# Lpet 开发手册

## 1. 项目定位

这是一个独立桌面宠物 App，当前核心能力是：

- Electron 桌面窗口、托盘、置顶、拖拽。
- React 渲染宠物动画和小窗 UI。
- 通过本机 Codex CLI 提供连续对话和代码任务入口。

项目不要直接适配 Codex Desktop 客户端私有能力。当前只集成 Codex CLI，后续可扩展其他 AI Provider。

## 2. 技术栈

- Electron 主进程：系统能力、进程管理、窗口管理、IPC。
- React + TypeScript：渲染进程 UI。
- Vite：前端开发和构建。
- CSS：当前使用原生 CSS，新增样式要保持简洁、克制、可扫描。

## 3. 目录规范

当前已有目录：

```text
electron/
src/
  assets/
  components/
  pet/
```

后续新增功能按下面方式扩展：

```text
src/api/
  codexApi.ts          # 渲染进程调用 Codex IPC 的统一封装
  settingsApi.ts       # 设置、检测类调用封装

src/features/
  codex-chat/          # Codex 聊天业务
  settings/            # 设置业务
  pet-actions/         # 宠物动作玩法

src/hooks/
  useCodexChat.ts
  usePetAction.ts

src/types/
  codex.ts
  pet.ts

electron/services/
  CodexCliService.ts   # Codex CLI 检测、执行、resume
  WindowService.ts     # 窗口和托盘能力
```

短期可以不强行重构已有文件，但新增复杂能力必须按这个方向拆分。

## 4. 分层规则

### Electron 主进程

负责：

- 启动/停止本地进程，如 Codex CLI。
- 检测本机环境，如 PATH、NVM、Homebrew。
- 窗口、托盘、系统权限、文件系统。
- 通过 IPC 给渲染进程返回结构化结果。

禁止：

- 让渲染进程传任意 shell 命令。
- 把不可信输入直接拼进命令字符串。

### Preload

负责暴露白名单 API，例如：

```ts
window.petDesktop.runCodex(prompt, target, sessionId, intent)
```

禁止：

- 暴露 `ipcRenderer` 本体。
- 暴露通用 `runCommand(command)`。

### API 层

以后所有请求都从 `src/api` 发起，包括：

- IPC 调用。
- HTTP 请求。
- 本地 Provider 调用。

组件不直接调用 `window.petDesktop`。已有代码可以逐步迁移。

### 组件层

负责：

- 展示 UI。
- 接收 props。
- 触发事件。

不负责：

- 拼 CLI 参数。
- 管理复杂 session 协议。
- 写大段业务状态机。

复杂逻辑优先放到 hook 或 feature service。

## 5. Codex CLI 集成规则

当前 Codex CLI 是一次性命令，不是真正常驻进程。

连续对话通过 session 续接实现：

```text
第一次：codex exec -
后续：codex exec resume <session-id> -
```

Prompt 通过 stdin 传入，不能直接拼到命令字符串里。

关键原因：

- 支持多行文本。
- 避免 shell 注入风险。
- 避免特殊字符被 CLI 参数解析破坏。

双击桌宠的快捷输入由用户显式选择 `chat` 或 `task`，不要再让 AI 自己判断用户意图：

- `chat`：普通问答，只显示 `thinking...` 和最终答案，不显示任务状态灯。
- `task`：执行任务，显示任务状态灯，最多 6 步。

提示词维护规则：

- 所有 Codex 桌宠协议提示词放在 `electron/prompts/*.txt`。
- 主进程只负责读取模板并注入 `{{historyContext}}`、`{{userPrompt}}`。
- 修改协议时必须同时检查前端解析器和构建脚本是否还能复制模板。

如果改 Codex CLI 协议，必须同时检查：

- `electron/main.ts`
- `electron/preload.cts`
- `src/vite-env.d.ts`
- Codex 聊天 UI 或后续 `src/api/codexApi.ts`

## 6. UI 规范

- 桌宠窗口空间很小，所有面板必须支持滚动。
- 文本不能溢出按钮、菜单、面板。
- 不做大块营销式视觉，不做复杂装饰背景。
- 状态提示要直接：已安装、未检测到、运行中、失败、已停止。
- 聊天输出保持轻量：普通文本 + 角色小点即可。
- user 消息标记使用橙黄色，AI 消息标记使用绿色。

## 7. 注释规则

只在关键逻辑写注释，优先解释 WHY：

- 为什么要在主进程做。
- 为什么用 stdin，不用命令字符串。
- 为什么要单实例锁。
- 为什么某段逻辑会影响安全、权限、并发或稳定性。

不要写无意义注释，例如“设置变量”“调用方法”。

## 8. 新功能开发流程

1. 先读 `AGENTS.md` 和本手册。
2. 明确功能属于哪个层：Electron、API、Feature、Component、Pet。
3. 小改动可直接改现有文件；复杂功能先新建 feature/api/hook。
4. 补充必要类型，避免 `any`。
5. 关键逻辑写中文 WHY 注释。
6. 执行 `npm run build`。
7. 如果改 Electron 主进程或 preload，提醒用户重启 `npm run dev`。

## 9. 当前已知约定

- 不做 Codex Desktop 客户端消息发送适配。
- Codex CLI 是当前唯一可发送任务目标。
- 宠物动作通过 `PetActionRegistry` 注册。
- 新玩法不要写死在 `PetRenderer`。
- 修改 `electron/main.ts` 或 `electron/preload.cts` 后必须完整重启 Electron。
