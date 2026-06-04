# Codex Pet Clone 开发约束

本项目是 Electron + React + TypeScript + Vite 桌面宠物应用。任何 AI 或开发者修改本目录下代码前，必须先阅读本文件和 `docs/DEVELOPMENT_GUIDE.md`。

## 核心原则

- 代码必须按生产项目维护，不写一次性 demo 逻辑。
- 新功能优先组件化、服务化、类型化，禁止把业务逻辑堆在 `App.tsx` 或单个大组件里。
- 所有跨进程能力必须通过 Electron IPC 封装，不允许在渲染进程暴露任意命令执行能力。
- 以后发起本地/远程请求，必须单独封装到 `src/api` 或 `electron/services`，组件不得直接拼 IPC、HTTP 或 CLI 参数。
- 关键逻辑必须写中文注释，解释为什么这么做、风险点是什么、为什么不选更脆的方案。

## 推荐目录职责

- `electron/`：Electron 主进程、preload、系统能力、CLI/本地进程调用。
- `src/api/`：渲染进程调用后端、IPC、Provider 的统一入口。
- `src/components/`：可复用 UI 组件，不承载复杂业务编排。
- `src/features/`：按业务域组织功能，如 `codex-chat`、`settings`、`pet-actions`。
- `src/hooks/`：可复用 React hooks。
- `src/pet/`：宠物动作、动画、状态机、渲染相关基础能力。
- `src/types/`：跨模块共享类型。
- `docs/`：开发手册、架构说明、协议文档。

## 开发硬约束

- React 只使用函数组件和 Hooks。
- 组件 props、IPC payload、业务状态必须有明确 TypeScript 类型。
- 组件只处理展示和局部交互，复杂流程应下沉到 hook、service 或 api 层。
- Electron 主进程负责系统权限边界：文件、进程、CLI、窗口、托盘都在主进程实现。
- preload 只暴露白名单 API，不透传 `ipcRenderer`。
- 新增 CSS 必须考虑小窗口宽高、文本溢出、滚动、按钮禁用态和焦点态。
- 修改 Electron 主进程或 preload 后，必须提醒用户重启 `npm run dev`，因为 Vite 热更新不会更新主进程。

## 验证要求

完成代码修改后默认执行：

```bash
npm run build
```

如果改了桌面交互、窗口尺寸、滚动、菜单或聊天输出，优先实际启动 `npm run dev` 做人工/截图验证。

## 输出要求

每次代码改动完成后，给出：

- 修改了哪些能力。
- 验证命令和结果。
- 简短英文 conventional commit。
