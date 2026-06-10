import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FALLBACK_CLI_SEARCH_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

export interface CodexInstallationCheck {
  cli: CliInstallationStatus;
  cursor: CliInstallationStatus;
  claudeCode: CliInstallationStatus;
  diagnostics: {
    pid: number;
    homeDir: string;
    configuredCliPath: string | null;
    configuredCursorPath: string | null;
    configuredClaudePath: string | null;
  };
}

export interface CliInstallationStatus {
  installed: boolean;
  path: string | null;
  source: 'env' | 'path' | 'nvm' | 'shell' | 'app' | null;
}

export function isExecutableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findNvmCliCandidates(commandName: string): string[] {
  const nvmVersionsRoot = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (!fs.existsSync(nvmVersionsRoot)) {
    return [];
  }

  try {
    return fs
      .readdirSync(nvmVersionsRoot)
      .map((versionName) => path.join(nvmVersionsRoot, versionName, 'bin', commandName))
      .filter(isExecutableFile);
  } catch {
    return [];
  }
}

function resolveCliFromShell(commandName: string): string | null {
  const shellCommands = [
    ['/bin/zsh', ['-lic', `command -v ${commandName}`]],
    ['/bin/zsh', ['-lc', `command -v ${commandName}`]],
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

function resolveCliPath({
  commandName,
  envName,
  appCandidatePaths = [],
}: {
  commandName: string;
  envName: string;
  appCandidatePaths?: string[];
}): CliInstallationStatus {
  const configuredCliPath = process.env[envName]?.trim();
  if (configuredCliPath && isExecutableFile(configuredCliPath)) {
    return { installed: true, path: configuredCliPath, source: 'env' };
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
    const cliPath = path.join(pathEntry, commandName);
    if (isExecutableFile(cliPath)) {
      return { installed: true, path: cliPath, source: 'path' };
    }
  }

  const nvmCliPath = findNvmCliCandidates(commandName)[0];
  if (nvmCliPath) {
    return { installed: true, path: nvmCliPath, source: 'nvm' };
  }

  for (const candidatePath of appCandidatePaths) {
    if (isExecutableFile(candidatePath)) {
      return { installed: true, path: candidatePath, source: 'app' };
    }
  }

  const shellCliPath = resolveCliFromShell(commandName);
  if (shellCliPath) {
    return { installed: true, path: shellCliPath, source: 'shell' };
  }

  return { installed: false, path: null, source: null };
}

export function resolveCodexCliPath(): CliInstallationStatus {
  return resolveCliPath({
    commandName: 'codex',
    envName: 'CODEX_CLI_PATH',
  });
}

export function checkCodexInstallations(): CodexInstallationCheck {
  const cli = resolveCodexCliPath();
  const cursor = resolveCliPath({
    commandName: 'cursor',
    envName: 'CURSOR_CLI_PATH',
    appCandidatePaths: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
  });
  const claudeCode = resolveCliPath({
    commandName: 'claude',
    envName: 'CLAUDE_CLI_PATH',
  });

  return {
    cli,
    cursor,
    claudeCode,
    diagnostics: {
      pid: process.pid,
      homeDir: os.homedir(),
      configuredCliPath: process.env.CODEX_CLI_PATH?.trim() || null,
      configuredCursorPath: process.env.CURSOR_CLI_PATH?.trim() || null,
      configuredClaudePath: process.env.CLAUDE_CLI_PATH?.trim() || null,
    },
  };
}
