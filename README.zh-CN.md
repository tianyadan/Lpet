# Lpet

简体中文 | [English](README.md)

Lpet 是一个基于 Electron、React、TypeScript 和 Vite 构建的桌面 AI 宠物。它把本地 Agent、模型供应商、Skills、记忆、定时提醒和快捷翻译整合成一个常驻桌面的轻量入口。

产品方向很明确：桌宠本体保持轻量、可爱和低打扰，复杂能力放到模型、CLI、Skills 和工作流里扩展。

## 产品模型

Lpet 的定位是一个人格化桌面 Agent 入口。

- **桌宠 UI**：透明无边框小窗口，支持待机、工作中、等待、完成、失败、打招呼、跳跃、拖拽等状态。
- **快捷输入**：双击桌宠即可快速问答或执行本地任务。
- **Agent 运行时**：Codex CLI 负责本地任务执行，模型供应商负责快速问答和翻译。
- **Skills**：通过本地 Skills 扩展定时提醒、日报等工作流。
- **Memory**：使用本地 SQLite 存储交互历史和宠物身份信息。
- **开发者陪伴**：可选监听本地 Git commit / push，记录编码推进节奏，并让桌宠对开发进展给出反馈。
- **Settings**：统一配置 CLI、模型供应商、宠物身份和翻译快捷键。

## 产品展示

### Agent 动作

![Agent actions](docs/gif/action.gif)

### 定时提醒

![Scheduled reminder](docs/gif/scheduled.gif)

### 本地记忆

![Memory](docs/gif/Memory.gif)

### 桌宠动画

![Pet jump](docs/gif/jump.gif)

## 产品功能

- 透明、无边框、始终置顶的桌面宠物窗口。
- 右键菜单支持设置、表情动作、窗口对话和托盘操作。
- 双击打开快捷对话，支持“问答”和“执行任务”两种模式。
- 支持通义千问和 DeepSeek 模型供应商。
- 集成 Codex CLI，用于执行本地任务。
- 支持扫描和选择本地 Skills。
- 内置 `scheduled-reminder` 定时提醒 Skill，基于 SQLite 轮询触发。
- 支持宠物身份配置：名字、主人、年龄、性别、爱好和简介。
- 本地保存交互记忆。
- 开发者陪伴模式：记录本地 Git commit / push 次数，把每日开发进展写入 SQLite，并通过桌宠气泡给予鼓励反馈。
- 支持快捷翻译和目标语言配置。
- 配置多模态模型后支持图片上传问答。
- 执行任务时支持步骤状态灯。
- AI 回复支持复制。
- Codex CLI 遇到沙箱权限问题时，支持本次任务提权重试。

## 安装

环境要求：

- Node.js 22+
- npm
- macOS 或 Windows
- 可选：Codex CLI，用于本地任务执行

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

构建渲染进程和 Electron 主进程：

```bash
npm run build
```

预览 Vite 渲染页面：

```bash
npm run preview
```

## 部署

当前仓库提供 Electron 应用源码和构建脚本，暂未接入 `.dmg`、`.exe` 或安装器打包。

后续发布建议：

- 接入 `electron-builder` 或 `electron-forge`。
- 配置 macOS 和 Windows 打包目标。
- 用户模型 API Key、本地记忆和 Skills 配置继续保存在用户本机。

开发阶段直接运行：

```bash
npm run dev
```

## 产品目录结构

```text
.
├── electron/                  # Electron 主进程、IPC、CLI/模型/提醒服务
│   ├── main.ts
│   ├── preload.cts
│   ├── prompts/               # 提示词模板
│   └── services/              # 基于 SQLite 的本地服务
├── src/                       # React 渲染进程
│   ├── assets/                # 桌宠精灵图和供应商 Logo
│   ├── components/            # UI 组件
│   ├── hooks/                 # 窗口、拖拽、缩放、鼠标穿透 Hooks
│   ├── pet/                   # 桌宠渲染、动画、常量、动作注册
│   └── utils/                 # 输出解析和图片工具
├── skills/                    # 本地 Skills
│   ├── scheduled-reminder/
│   └── send-daily-report/
├── docs/
│   ├── DEVELOPMENT_GUIDE.md
│   └── gif/                   # README 展示动图
├── dist-electron/             # 编译后的 Electron 文件
└── scripts/                   # 构建辅助脚本
```

## 开发说明

让 AI Agent 或贡献者修改项目前，建议先阅读：

- [dev-rules.md](dev-rules.md)
- [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)

核心约束：

- UI 组件保持可复用和边界清晰。
- IPC 必须显式、安全。
- 提示词模板放在 `electron/prompts`。
- 工作流扩展放在 `skills`。
- 本地数据默认保存在用户本机，避免上传隐私数据。

## Roadmap

- 打包 macOS 和 Windows 安装器。
- 接入更多模型供应商。
- 增加更多官方 Skills。
- 增加更丰富的宠物状态和可配置人格。
- 支持用户自托管服务下的跨设备或情侣互动工作流。
