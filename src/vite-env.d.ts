/// <reference types="vite/client" />

interface PetDesktopApi {
  hide: () => Promise<void>;
  quit: () => Promise<void>;
  setMousePassthrough: (ignore: boolean) => Promise<void>;
  openCodexPanel: () => Promise<void>;
  closeCodexPanel: () => Promise<void>;
  resizeCurrentWindow: (width: number, height: number) => Promise<void>;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  setWindowPosition: (x: number, y: number) => Promise<void>;
  setPetAnchorPosition: (anchorX: number, anchorY: number, scale?: number) => Promise<void>;
  setWindowSizeKeepBottomRight: (width: number, height: number) => Promise<void>;
  checkCodexInstallations: () => Promise<CodexInstallationCheck>;
  runCodex: (
    prompt: string,
    target: CodexRunTarget,
    sessionId?: string | null,
    intent?: CodexRunIntent,
  ) => Promise<void>;
  cancelCodex: () => Promise<void>;
  onCodexEvent: (callback: (event: CodexCliEvent) => void) => () => void;
}

interface Window {
  petDesktop?: PetDesktopApi;
}

type CodexCliEvent =
  | { type: 'start'; command: string; cwd: string; sessionId: string | null; intent: CodexRunIntent }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'cancelled' };

type CodexRunTarget = 'codex-cli';
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
