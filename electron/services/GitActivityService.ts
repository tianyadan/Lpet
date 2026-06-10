import { app } from 'electron';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isExecutableFile } from './CliDetectionService.js';
import { type GitActivityEvent, InteractionHistoryService } from './InteractionHistoryService.js';

type SendEvent = (payload: Record<string, unknown>) => void;

export class GitActivityService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly historyService: InteractionHistoryService,
    private readonly sendEvent: SendEvent,
  ) {}

  getStatus() {
    const today = getLocalDateKey();
    const yesterday = getLocalDateKey(-1);
    return {
      ...this.getInstallStatus(),
      config: this.historyService.getGitActivityConfig(),
      todayStats: this.historyService.getGitActivityStatsForDate(today),
      yesterdayStats: this.historyService.getGitActivityStatsForDate(yesterday),
      recentEvents: this.historyService.listRecentGitActivityEvents(8),
    };
  }

  installAndConfigureShell() {
    this.installWrapper();
    this.writePathToShellProfiles();
    this.historyService.saveGitActivityConfig({ enabled: true });
    return this.getStatus();
  }

  startScheduler(): void {
    if (this.pollTimer) {
      return;
    }

    this.pollEvents();
    this.pollTimer = setInterval(() => this.pollEvents(), 8_000);
  }

  stopScheduler(): void {
    if (!this.pollTimer) {
      return;
    }

    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private getDatabasePath(): string {
    return path.join(app.getPath('userData'), 'pet.db');
  }

  private getInstallStatus() {
    const lpetHome = getLpetHome();
    const binDir = path.join(lpetHome, 'bin');
    const wrapperPath = path.join(binDir, 'git');
    const recorderPath = path.join(lpetHome, 'scripts', 'record-git-activity.cjs');
    const zshrcPath = path.join(os.homedir(), '.zshrc');
    const zprofilePath = path.join(os.homedir(), '.zprofile');
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const bashProfilePath = path.join(os.homedir(), '.bash_profile');
    const pathLine = 'export PATH="$HOME/.lpet/bin:$PATH"';
    const pathBlock = buildGitActivityPathBlock();
    const zshrcContent = fs.existsSync(zshrcPath) ? fs.readFileSync(zshrcPath, 'utf8') : '';
    const zprofileContent = fs.existsSync(zprofilePath) ? fs.readFileSync(zprofilePath, 'utf8') : '';
    const bashrcContent = fs.existsSync(bashrcPath) ? fs.readFileSync(bashrcPath, 'utf8') : '';
    const bashProfileContent = fs.existsSync(bashProfilePath) ? fs.readFileSync(bashProfilePath, 'utf8') : '';
    const currentPathEntries = (process.env.PATH ?? '').split(path.delimiter).map((entry) => path.resolve(entry || '.'));

    return {
      wrapperInstalled: isExecutableFile(wrapperPath),
      zshrcConfigured: zshrcContent.includes(pathLine) || zshrcContent.includes('LPET_GIT_ACTIVITY_PATH'),
      zprofileConfigured: zprofileContent.includes(pathLine) || zprofileContent.includes('LPET_GIT_ACTIVITY_PATH'),
      bashrcConfigured: bashrcContent.includes(pathLine) || bashrcContent.includes('LPET_GIT_ACTIVITY_PATH'),
      bashProfileConfigured: bashProfileContent.includes(pathLine) || bashProfileContent.includes('LPET_GIT_ACTIVITY_PATH'),
      currentShellConfigured: currentPathEntries.includes(path.resolve(binDir)),
      wrapperPath,
      recorderPath,
      realGitPath: this.resolveRealGitPath(),
      nodePath: resolveNodePath(),
      databasePath: this.getDatabasePath(),
      pathLine,
      pathBlock,
    };
  }

  private resolveRealGitPath(): string | null {
    const lpetBin = path.join(getLpetHome(), 'bin');
    const wrapperPath = path.join(lpetBin, 'git');
    const pathEntries = (process.env.PATH ?? '')
      .split(path.delimiter)
      .filter((entry) => entry && path.resolve(entry) !== path.resolve(lpetBin));
    const candidatePaths = Array.from(new Set([...pathEntries, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']));
    for (const entry of candidatePaths) {
      const candidate = path.join(entry, 'git');
      if (isExecutableFile(candidate) && path.resolve(candidate) !== path.resolve(wrapperPath)) {
        return candidate;
      }
    }
    return null;
  }

  private installWrapper() {
    const realGitPath = this.resolveRealGitPath();
    const nodePath = resolveNodePath();
    if (!realGitPath) {
      throw new Error('未找到真实 git 可执行文件。');
    }
    if (!nodePath) {
      throw new Error('未找到 node 可执行文件，请先安装 Node.js。');
    }

    const lpetHome = getLpetHome();
    const binDir = path.join(lpetHome, 'bin');
    const scriptsDir = path.join(lpetHome, 'scripts');
    const wrapperPath = path.join(binDir, 'git');
    const recorderPath = path.join(scriptsDir, 'record-git-activity.cjs');
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(recorderPath, buildGitActivityRecorderScript(), { mode: 0o755 });
    fs.writeFileSync(wrapperPath, buildGitWrapperScript(realGitPath, nodePath, recorderPath, this.getDatabasePath()), { mode: 0o755 });
    return this.getInstallStatus();
  }

  private writePathToShellProfiles() {
    // WHY：Cursor、macOS Terminal 和 VS Code 对 login/interactive shell 的启动方式不同，只写 .zshrc 容易漏掉。
    for (const profileName of ['.zshrc', '.zprofile', '.bashrc', '.bash_profile']) {
      writeGitActivityPathToProfile(path.join(os.homedir(), profileName));
    }
    return this.getInstallStatus();
  }

  private buildBubble(event: GitActivityEvent): string {
    const stats = this.historyService.getGitActivityStatsForDate(getLocalDateKey());
    if (event.eventType === 'push') {
      return `今天第 ${stats.pushCount} 次 push，项目真的在往前走。`;
    }

    const message = event.translatedMessage || event.commitMessage;
    return `今天第 ${stats.commitCount} 次 commit${message ? `：${message}` : ''}。节奏不错，继续推进。`;
  }

  private pollEvents(): void {
    const config = this.historyService.getGitActivityConfig();
    if (!config.enabled) {
      return;
    }

    const events = this.historyService.listUnnotifiedGitActivityEvents(5);
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      this.sendEvent({
        type: 'git-activity',
        eventType: event.eventType,
        text: this.buildBubble(event),
      });
    }
    this.historyService.markGitActivityEventsNotified(events.map((event) => event.id));
  }
}

function getLpetHome(): string {
  return path.join(os.homedir(), '.lpet');
}

function resolveNodePath(): string | null {
  if (process.env.CODEX_PET_NODE_PATH && isExecutableFile(process.env.CODEX_PET_NODE_PATH)) {
    return process.env.CODEX_PET_NODE_PATH;
  }

  const result = spawnSync('/bin/zsh', ['-lc', 'command -v node'], {
    encoding: 'utf8',
    timeout: 3000,
  });
  const nodePath = result.stdout.trim().split('\n').at(-1)?.trim();
  if (nodePath && isExecutableFile(nodePath)) {
    return nodePath;
  }

  for (const candidate of ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node']) {
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildGitActivityRecorderScript(): string {
  return `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const [eventType, repoPath, realGitPath, dbPath, remote = ''] = process.argv.slice(2);
if (!eventType || !repoPath || !realGitPath || !dbPath) {
  process.exit(0);
}

function git(args) {
  const result = spawnSync(realGitPath, args, { cwd: repoPath, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(\`
    CREATE TABLE IF NOT EXISTS git_activity_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      translate_commit INTEGER NOT NULL DEFAULT 0,
      summary_time TEXT NOT NULL DEFAULT '20:00',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS git_activity_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT '',
      remote TEXT NOT NULL DEFAULT '',
      commit_hash TEXT NOT NULL DEFAULT '',
      commit_message TEXT NOT NULL DEFAULT '',
      translated_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      notified_at TEXT NOT NULL DEFAULT ''
    );
  \`);

  const config = db.prepare('SELECT enabled FROM git_activity_config WHERE id = 1').get();
  if (!config || config.enabled !== 1) {
    db.close();
    process.exit(0);
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitHash = eventType === 'commit' ? git(['log', '-1', '--pretty=%H']) : '';
  const commitMessage = eventType === 'commit' ? git(['log', '-1', '--pretty=%s']) : '';
  const now = new Date().toISOString();
  db.prepare(\`
    INSERT INTO git_activity_events (
      id,
      event_type,
      repo_path,
      branch,
      remote,
      commit_hash,
      commit_message,
      translated_message,
      created_at,
      notified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, '')
  \`).run(randomUUID(), eventType, repoPath, branch, remote, commitHash, commitMessage, now);
  db.close();
} catch {
  process.exit(0);
}
`;
}

function buildGitWrapperScript(realGitPath: string, nodePath: string, recorderPath: string, databasePath: string): string {
  return `#!/usr/bin/env bash
REAL_GIT=${JSON.stringify(realGitPath)}
NODE_BIN=${JSON.stringify(nodePath)}
RECORDER=${JSON.stringify(recorderPath)}
DB_PATH=${JSON.stringify(databasePath)}

COMMAND=""
REMOTE=""
SKIP_NEXT=0
NEXT_IS_CWD=0
GIT_CWD="$PWD"
for ARG in "$@"; do
  if [ "$NEXT_IS_CWD" -eq 1 ]; then
    GIT_CWD="$ARG"
    NEXT_IS_CWD=0
    continue
  fi
  if [ "$SKIP_NEXT" -eq 1 ]; then
    SKIP_NEXT=0
    continue
  fi
  case "$ARG" in
    -C)
      NEXT_IS_CWD=1
      continue
      ;;
    --git-dir|--work-tree)
      SKIP_NEXT=1
      continue
      ;;
    -*)
      continue
      ;;
    *)
      if [ -z "$COMMAND" ]; then
        COMMAND="$ARG"
      elif [ "$COMMAND" = "push" ] && [ -z "$REMOTE" ]; then
        REMOTE="$ARG"
      fi
      ;;
  esac
done

"$REAL_GIT" "$@"
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  REPO_PATH=$("$REAL_GIT" -C "$GIT_CWD" rev-parse --show-toplevel 2>/dev/null || printf "%s" "$GIT_CWD")
  if [ "$COMMAND" = "commit" ]; then
    "$NODE_BIN" "$RECORDER" commit "$REPO_PATH" "$REAL_GIT" "$DB_PATH" >/dev/null 2>&1 &
  elif [ "$COMMAND" = "push" ]; then
    "$NODE_BIN" "$RECORDER" push "$REPO_PATH" "$REAL_GIT" "$DB_PATH" "$REMOTE" >/dev/null 2>&1 &
  fi
fi

exit "$EXIT_CODE"
`;
}

function buildGitActivityPathBlock(): string {
  return [
    '# Lpet Git activity tracking',
    'export LPET_GIT_ACTIVITY_PATH="$HOME/.lpet/bin"',
    'case ":$PATH:" in',
    '  *":$LPET_GIT_ACTIVITY_PATH:"*) ;;',
    '  *) export PATH="$LPET_GIT_ACTIVITY_PATH:$PATH" ;;',
    'esac',
  ].join('\n');
}

function writeGitActivityPathToProfile(profilePath: string): void {
  const pathBlock = buildGitActivityPathBlock();
  const currentContent = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : '';
  if (!currentContent.includes('LPET_GIT_ACTIVITY_PATH')) {
    const nextContent = `${currentContent.trimEnd()}\n\n${pathBlock}\n`;
    fs.writeFileSync(profilePath, nextContent);
  }
}

function getLocalDateKey(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
