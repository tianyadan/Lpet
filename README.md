# Lpet

[简体中文](README.zh-CN.md) | English

Lpet is a desktop AI pet built with Electron, React, TypeScript, and Vite. It turns local agents, model providers, skills, memory, reminders, and quick translation into a small always-on-top desktop companion.

The product direction is simple: keep the pet visually lightweight, keep animations controllable, and put most extensibility into tools, skills, and workflows.

## Product Model

Lpet is designed as a personal agent entry point on the desktop.

- **Pet UI**: a small transparent desktop pet with idle, work, waiting, review, failed, waving, jumping, and drag animations.
- **Quick input**: double-click the pet to ask questions or run local tasks.
- **Agent runtime**: Codex CLI can execute local tasks, while configured model providers handle fast Q&A and translation.
- **Skills**: local skills extend workflows such as scheduled reminders or daily reports.
- **Memory**: local SQLite stores interaction history and pet identity.
- **Settings**: configure CLI tools, model providers, pet identity, and translation shortcuts.

## Demo

### Agent Actions

![Agent actions](docs/gif/action.gif)

### Scheduled Reminder

![Scheduled reminder](docs/gif/scheduled.gif)

### Memory

![Memory](docs/gif/Memory.gif)

### Pet Animation

![Pet jump](docs/gif/jump.gif)

## Features

- Transparent, frameless, always-on-top desktop pet window.
- Right-click menu for settings, expressions, window dialog, and tray actions.
- Double-click quick command panel with Q&A and task modes.
- Model provider support for Qwen and DeepSeek.
- Codex CLI integration for local task execution.
- Skills picker with local skill discovery.
- Scheduled reminder skill backed by SQLite polling.
- Pet identity settings: name, owner, age, gender, hobbies, and bio.
- Interaction memory stored locally.
- Quick translation shortcut with configurable target language.
- Image upload support when a vision model is configured.
- Task status lights for multi-step agent work.
- Copy button for AI replies.
- Per-task elevated retry when Codex CLI hits sandbox permission issues.

## Installation

Requirements:

- Node.js 22+
- npm
- macOS or Windows
- Optional: Codex CLI for local task execution

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

Build the renderer and Electron main process:

```bash
npm run build
```

Preview the Vite renderer:

```bash
npm run preview
```

## Deployment

This repository currently provides the Electron app source and build output scripts. Packaging into `.dmg`, `.exe`, or installer formats is not enabled yet.

Recommended next step for distribution:

- Add `electron-builder` or `electron-forge`.
- Configure macOS and Windows targets.
- Keep user model API keys, local memory, and skill configs stored on the user's machine.

For development usage, run:

```bash
npm run dev
```

## Project Structure

```text
.
├── electron/                  # Electron main process, IPC, CLI/model/reminder services
│   ├── main.ts
│   ├── preload.cts
│   ├── prompts/               # Prompt templates
│   └── services/              # SQLite-backed local services
├── src/                       # React renderer
│   ├── assets/                # Pet sprites and provider logos
│   ├── components/            # UI components
│   ├── hooks/                 # Window, drag, scale, mouse passthrough hooks
│   ├── pet/                   # Pet renderer, animation, constants, action registry
│   └── utils/                 # Output parsing and image helpers
├── skills/                    # Local skills
│   ├── scheduled-reminder/
│   └── send-daily-report/
├── docs/
│   ├── DEVELOPMENT_GUIDE.md
│   └── gif/                   # README demo GIFs
├── dist-electron/             # Compiled Electron files
└── scripts/                   # Build helper scripts
```

## Development Guide

Before asking an AI agent or contributor to modify this project, read:

- [AGENTS.md](AGENTS.md)
- [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)

Core principles:

- Keep UI components reusable and scoped.
- Keep IPC explicit and safe.
- Put prompt templates under `electron/prompts`.
- Put workflow extensions under `skills`.
- Keep local data private and stored on the user's machine.

## Roadmap

- Package desktop installers for macOS and Windows.
- Add more model providers.
- Add more official skills.
- Add richer pet states and user-configurable personalities.
- Add optional cross-device or partner workflows through a user-owned server.
