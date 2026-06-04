import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InteractionHistoryService } from './services/InteractionHistoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let petWindow: BrowserWindow | null = null;
let codexWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeCodexProcess: ChildProcessWithoutNullStreams | null = null;
let activeRun:
  | {
      id: string;
      prompt: string;
      intent: CodexRunIntent;
      rawOutput: string;
      cwd: string;
      startedAt: string;
      sessionId: string | null;
      statusOverride: 'cancelled' | null;
    }
  | null = null;

const FALLBACK_CLI_SEARCH_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const historyService = new InteractionHistoryService();
const sessionIdPattern = /session id:\s*([0-9a-f-]{36})/i;
type CodexRunIntent = 'chat' | 'task';

interface CodexInstallationCheck {
  cli: {
    installed: boolean;
    path: string | null;
    source: 'env' | 'path' | 'nvm' | 'shell' | null;
  };
  diagnostics: {
    pid: number;
    homeDir: string;
    configuredCliPath: string | null;
  };
}

function loadRenderer(window: BrowserWindow, view: 'pet' | 'codex'): void {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? (!app.isPackaged ? 'http://127.0.0.1:5173' : null);

  if (devServerUrl) {
    const url = new URL(devServerUrl);
    url.searchParams.set('view', view);
    void window.loadURL(url.toString());
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view },
    });
  }
}

function createPetWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const window = new BrowserWindow({
    width: 440,
    height: 560,
    x: width - 320,
    y: height - 360,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadRenderer(window, 'pet');

  return window;
}

function createCodexWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const window = new BrowserWindow({
    width: 420,
    height: 520,
    minWidth: 320,
    minHeight: 340,
    x: Math.max(40, width - 760),
    y: Math.max(40, height - 620),
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.on('closed', () => {
    codexWindow = null;
  });
  loadRenderer(window, 'codex');

  return window;
}

function openCodexWindow(): void {
  if (!codexWindow || codexWindow.isDestroyed()) {
    codexWindow = createCodexWindow();
    return;
  }

  codexWindow.show();
  codexWindow.focus();
}

function isExecutableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findNvmCodexCandidates(): string[] {
  const nvmVersionsRoot = path.join(os.homedir(), '.nvm/versions/node');
  if (!fs.existsSync(nvmVersionsRoot)) {
    return [];
  }

  try {
    return fs
      .readdirSync(nvmVersionsRoot)
      .map((versionName) => path.join(nvmVersionsRoot, versionName, 'bin/codex'))
      .filter(isExecutableFile);
  } catch {
    return [];
  }
}

function resolveCodexFromShell(): string | null {
  const shellCommands = [
    ['/bin/zsh', ['-lic', 'command -v codex']],
    ['/bin/zsh', ['-lc', 'command -v codex']],
  ] as const;

  for (const [shellPath, shellArgs] of shellCommands) {
    const result = spawnSync(shellPath, shellArgs, {
      env: process.env,
      encoding: 'utf8',
      timeout: 3000,
    });
    const resolvedPath = result.stdout.trim().split('\n').at(-1)?.trim();
    if (resolvedPath && isExecutableFile(resolvedPath)) {
      return resolvedPath;
    }
  }

  return null;
}

function resolveCodexCliPath(): { path: string | null; source: 'env' | 'path' | 'nvm' | 'shell' | null } {
  const configuredCliPath = process.env.CODEX_CLI_PATH?.trim();
  if (configuredCliPath && isExecutableFile(configuredCliPath)) {
    return { path: configuredCliPath, source: 'env' };
  }

  const pathEntries = Array.from(
    new Set(
      (process.env.PATH ?? '')
        .split(path.delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .concat(FALLBACK_CLI_SEARCH_PATHS),
    ),
  );

  for (const pathEntry of pathEntries) {
    const cliPath = path.join(pathEntry, 'codex');
    if (isExecutableFile(cliPath)) {
      return { path: cliPath, source: 'path' };
    }
  }

  const nvmCliPath = findNvmCodexCandidates()[0];
  if (nvmCliPath) {
    return { path: nvmCliPath, source: 'nvm' };
  }

  const shellCliPath = resolveCodexFromShell();
  if (shellCliPath) {
    return { path: shellCliPath, source: 'shell' };
  }

  return { path: null, source: null };
}

function checkCodexInstallations(): CodexInstallationCheck {
  const cli = resolveCodexCliPath();

  return {
    cli: {
      installed: Boolean(cli.path),
      path: cli.path,
      source: cli.source,
    },
    diagnostics: {
      pid: process.pid,
      homeDir: os.homedir(),
      configuredCliPath: process.env.CODEX_CLI_PATH?.trim() || null,
    },
  };
}

function sendCodexEvent(payload: Record<string, unknown>): void {
  petWindow?.webContents.send('codex:event', payload);
  codexWindow?.webContents.send('codex:event', payload);
}

function extractSessionId(output: string): string | null {
  return output.match(sessionIdPattern)?.[1] ?? null;
}

function extractAssistantText(output: string): string {
  const placeholderAnswerPatterns = [/这里写/, /最终结果/, /给用户的回答/, /真实回答/];

  function extractPetResponse(text: string): string {
    const matches = Array.from(text.matchAll(/<CodexPetResponse>([\s\S]*?)<\/CodexPetResponse>/gi));
    const latestResponse = matches.at(-1)?.[1]?.trim();
    if (!latestResponse) {
      return '';
    }

    try {
      const parsed = JSON.parse(latestResponse) as { answer?: unknown };
      if (typeof parsed.answer !== 'string') {
        return '';
      }

      const answer = parsed.answer.trim();
      return placeholderAnswerPatterns.some((pattern) => pattern.test(answer)) ? '' : answer;
    } catch {
      return '';
    }
  }

  function stripProtocol(text: string): string {
    return text
      .replace(/<CodexPetResponse>[\s\S]*?<\/CodexPetResponse>/gi, '')
      .replace(/<CodexPetPlan>[\s\S]*?<\/CodexPetPlan>/gi, '')
      .replace(/<CodexPetProgress\s+step="\d+"\s+status="(?:done|failed|running)"\s*\/>/gi, '')
      .replace(/<CodexPetHistory>[\s\S]*?<\/CodexPetHistory>/gi, '')
      .replace(/^OpenAI Codex v[\s\S]*?--------\n/m, '')
      .replace(/^workdir:[\s\S]*?--------\n/m, '')
      .replace(/^user\n[\s\S]*?\ncodex\n/m, '')
      .replace(/\ntokens used[\s\S]*$/i, '')
      .trim();
  }

  const petResponseAnswer = extractPetResponse(output);
  if (petResponseAnswer) {
    return petResponseAnswer;
  }

  const codexStartIndex = output.lastIndexOf('\ncodex\n');
  if (codexStartIndex < 0) {
    return stripProtocol(output);
  }

  const contentStartIndex = codexStartIndex + '\ncodex\n'.length;
  const contentEndIndex = output.indexOf('\ntokens used', contentStartIndex);
  return stripProtocol(output.slice(contentStartIndex, contentEndIndex > -1 ? contentEndIndex : undefined));
}

function shouldAttachHistoryContext(prompt: string): boolean {
  return /刚才|之前|历史|记录|做了什么|交互|问过/.test(prompt);
}

function buildHistoryContext(prompt: string): string {
  if (!shouldAttachHistoryContext(prompt)) {
    return '';
  }

  const recentRecords = historyService.listRecent(8);
  if (recentRecords.length === 0) {
    return '';
  }

  return [
    '以下是桌宠本地记录的最近交互，用户询问历史时优先基于这些记录回答：',
    ...recentRecords.map((record, index) => {
      const reply = record.assistantReply.slice(0, 600);
      return `${index + 1}. ${record.startedAt} 用户：${record.userPrompt}\n   AI：${reply}`;
    }),
  ].join('\n');
}

function readPromptTemplate(templateName: 'chat' | 'task'): string {
  const templateFileName = `${templateName}.txt`;
  const candidates = [
    path.join(process.cwd(), 'electron/prompts', templateFileName),
    path.join(__dirname, 'prompts', templateFileName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }

  throw new Error(`Prompt template not found: ${templateFileName}`);
}

function buildCodexPetPrompt(prompt: string, intent: CodexRunIntent): string {
  const historyContext = buildHistoryContext(prompt);
  const template = readPromptTemplate(intent);

  // WHY：提示词放在文本文件里，后续调协议不需要改主进程代码；运行时只注入必要变量，避免模板散落在业务逻辑里。
  return template
    .replace('{{historyContext}}', historyContext ? `<CodexPetHistory>\n${historyContext}\n</CodexPetHistory>` : '')
    .replace('{{userPrompt}}', prompt)
    .trim();
}

function finishActiveRun(status: 'success' | 'failed' | 'cancelled'): void {
  if (!activeRun) {
    return;
  }

  const nextSessionId = extractSessionId(activeRun.rawOutput) ?? activeRun.sessionId;
  historyService.insert({
    id: activeRun.id,
    provider: 'codex-cli',
    userPrompt: activeRun.prompt,
    assistantReply: extractAssistantText(activeRun.rawOutput),
    status,
    sessionId: nextSessionId,
    cwd: activeRun.cwd,
    startedAt: activeRun.startedAt,
    endedAt: new Date().toISOString(),
  });
  activeRun = null;
}

function normalizeCodexRunIntent(intent: unknown): CodexRunIntent {
  return intent === 'chat' || intent === 'task' ? intent : 'task';
}

function runCodexPrompt(prompt: string, target: string, sessionId?: string | null, intent: CodexRunIntent = 'task'): void {
  if (activeCodexProcess) {
    throw new Error('Codex task is already running');
  }

  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error('Prompt is empty');
  }

  if (target !== 'codex-cli') {
    throw new Error('Unsupported Codex target');
  }

  const resolvedCli = resolveCodexCliPath();
  if (!resolvedCli.path) {
    throw new Error('未检测到 Codex CLI。请先安装 CLI，或通过 CODEX_CLI_PATH 指定可执行文件路径。');
  }

  const codexPath = resolvedCli.path;
  const workspaceRoot = process.cwd();
  const wrappedPrompt = buildCodexPetPrompt(normalizedPrompt, intent);
  const args = sessionId
    ? ['exec', 'resume', '--skip-git-repo-check', sessionId, '-']
    : ['exec', '--color', 'never', '--skip-git-repo-check', '-C', workspaceRoot, '-'];

  // WHY：prompt 通过 stdin 传入，避免长文本、换行或特殊字符被命令行参数解析破坏。
  // Codex CLI 在检测到 stdin pipe 时会等待输入，因此必须在 spawn 后立即 end，否则会一直停在 Reading additional input。
  sendCodexEvent({
    type: 'start',
    command: `${codexPath} ${sessionId ? 'exec resume' : 'exec'}`,
    cwd: workspaceRoot,
    sessionId: sessionId ?? null,
    intent,
  });
  activeRun = {
    id: randomUUID(),
    prompt: normalizedPrompt,
    intent,
    rawOutput: '',
    cwd: workspaceRoot,
    startedAt: new Date().toISOString(),
    sessionId: sessionId ?? null,
    statusOverride: null,
  };

  const child = spawn(codexPath, args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  });

  activeCodexProcess = child;
  child.stdin.end(wrappedPrompt);

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    if (activeRun) {
      activeRun.rawOutput += text;
    }
    sendCodexEvent({ type: 'stdout', text });
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    if (activeRun) {
      activeRun.rawOutput += text;
    }
    sendCodexEvent({ type: 'stderr', text });
  });

  child.on('error', (error) => {
    if (activeCodexProcess === child) {
      activeCodexProcess = null;
    }
    finishActiveRun('failed');
    sendCodexEvent({ type: 'error', message: error.message });
  });

  child.on('close', (code, signal) => {
    if (activeCodexProcess === child) {
      activeCodexProcess = null;
    }
    finishActiveRun(activeRun?.statusOverride ?? (code === 0 ? 'success' : 'failed'));
    sendCodexEvent({ type: 'exit', code, signal });
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Codex Pet Clone');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示宠物',
        click: () => {
          petWindow?.show();
        },
      },
      {
        label: '退出',
        click: () => {
          app.quit();
        },
      },
    ]),
  );
}

function registerIpc(): void {
  ipcMain.handle('pet:hide', () => {
    petWindow?.hide();
  });

  ipcMain.handle('pet:quit', () => {
    app.quit();
  });

  ipcMain.handle('codex-panel:open', () => {
    openCodexWindow();
  });

  ipcMain.handle('codex-panel:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle('window:resize-current', (event, width: unknown, height: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || typeof width !== 'number' || typeof height !== 'number') {
      return;
    }
    window.setSize(Math.max(320, Math.round(width)), Math.max(340, Math.round(height)));
  });

  ipcMain.handle('codex:check-installations', () => checkCodexInstallations());

  ipcMain.handle('codex:run', (_event, prompt: unknown, target: unknown, sessionId: unknown, intent: unknown) => {
    if (typeof prompt !== 'string') {
      throw new Error('Prompt must be a string');
    }
    const normalizedTarget = typeof target === 'string' ? target : 'codex-cli';
    const normalizedSessionId = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
    runCodexPrompt(prompt, normalizedTarget, normalizedSessionId, normalizeCodexRunIntent(intent));
  });

  ipcMain.handle('codex:cancel', () => {
    if (!activeCodexProcess) {
      return;
    }
    if (activeRun) {
      activeRun.statusOverride = 'cancelled';
    }
    activeCodexProcess.kill('SIGTERM');
    sendCodexEvent({ type: 'cancelled' });
  });
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // WHY：开发模式下多次 npm run dev 很容易留下旧 Electron 窗口；单实例能避免用户点到旧主进程。
    if (petWindow) {
      petWindow.show();
      petWindow.focus();
    }
    codexWindow?.show();
  });

  app.whenReady().then(() => {
    historyService.init();
    registerIpc();
    petWindow = createPetWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        petWindow = createPetWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  // WHY：桌宠以托盘作为常驻入口，窗口关闭后不主动退出，避免用户误关后找不到恢复入口。
});
