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
  listLocalSkills: () => Promise<LocalSkill[]>;
  listImportedPetSkins: () => Promise<PetSkinOption[]>;
  importPetSkinFolder: () => Promise<PetSkinOption | null>;
  getPetIdentity: () => Promise<PetIdentity>;
  savePetIdentity: (identity: PetIdentityInput) => Promise<PetIdentity>;
  listModelProviderConfigs: () => Promise<PublicModelProviderConfig[]>;
  saveModelProviderConfig: (config: ModelProviderConfigInput) => Promise<PublicModelProviderConfig>;
  testModelProviderConnection: (config: ModelProviderConfigInput) => Promise<PublicModelProviderConfig>;
  chatWithModelProvider: (input: ModelProviderChatInput) => Promise<{ answer: string }>;
  analyzeImageWithVisionModel: (input: { prompt: string; imageDataUrl: string }) => Promise<string>;
  getReminder: (id: string) => Promise<ReminderTask | null>;
  listActiveReminders: () => Promise<ReminderTask[]>;
  updateReminder: (input: ReminderTaskUpdateInput) => Promise<ReminderTask | null>;
  cancelReminder: (id: string) => Promise<ReminderTask | null>;
  completeReminder: (id: string) => Promise<ReminderTask | null>;
  snoozeReminder: (id: string, hours: number, minutes: number) => Promise<ReminderTask | null>;
  closeReminder: (id: string) => Promise<void>;
  getTranslationConfig: () => Promise<TranslationConfig>;
  saveTranslationConfig: (config: TranslationConfigInput) => Promise<TranslationConfig>;
  runCodex: (
    prompt: string,
    target: CodexRunTarget,
    sessionId?: string | null,
    intent?: CodexRunIntent,
    elevated?: boolean,
  ) => Promise<void>;
  cancelCodex: () => Promise<void>;
  onCodexEvent: (callback: (event: CodexCliEvent) => void) => () => void;
}

interface Window {
  petDesktop?: PetDesktopApi;
}

type CodexCliEvent =
  | { type: 'start'; command: string; cwd: string; sessionId: string | null; intent: CodexRunIntent; elevated?: boolean }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'cancelled' }
  | { type: 'reminder-created'; id: string; title: string; remindAt: string }
  | { type: 'reminders-updated' }
  | { type: 'translation-start'; targetLanguage: string }
  | { type: 'translation-result'; text: string; sourceText: string; targetLanguage: string; provider: string }
  | { type: 'translation-error'; message: string };

type CodexRunTarget = 'codex-cli';
type CodexRunIntent = 'chat' | 'task';
type PetGender = 'male' | 'female' | 'other';
type PetSkinSource = 'built-in' | 'imported';
type ModelProviderId = 'qwen' | 'deepseek';
type ModelProviderTestStatus = 'unknown' | 'success' | 'failed';
type LocalSkillSource = 'codex' | 'project' | 'agents';

interface LocalSkill {
  id: string;
  name: string;
  description: string;
  entryPath: string;
  enabled: boolean;
  source: LocalSkillSource;
}

interface PetSkinOption {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
  source: PetSkinSource;
  directoryPath?: string;
}

type ReminderTaskStatus = 'pending' | 'fired' | 'done' | 'cancelled';

interface ReminderTask {
  id: string;
  title: string;
  originalText: string;
  remindAt: string;
  timezone: string;
  status: ReminderTaskStatus;
  snoozeUntil: string;
  createdAt: string;
  updatedAt: string;
  firedAt: string;
}

interface ReminderTaskUpdateInput {
  id: string;
  title: string;
  remindAt: string;
  originalText?: string;
  timezone?: string;
}

type TranslationTargetLanguage = 'english' | 'chinese' | 'russian' | 'french' | 'japanese' | 'italian';

interface TranslationConfig {
  targetLanguage: TranslationTargetLanguage;
  shortcut: string;
  updatedAt: string;
}

interface TranslationConfigInput {
  targetLanguage: TranslationTargetLanguage;
  shortcut: string;
}

interface PetIdentity {
  name: string;
  owner: string;
  age: string;
  hobbies: string;
  gender: PetGender;
  bio: string;
  updatedAt: string;
}

interface PetIdentityInput {
  name: string;
  owner: string;
  age: string;
  hobbies: string;
  gender: PetGender;
  bio: string;
  updatedAt?: string;
}

interface ModelProviderConfigInput {
  provider: ModelProviderId;
  apiKey?: string;
  languageModelName: string;
  visionModelName?: string;
}

interface PublicModelProviderConfig {
  provider: ModelProviderId;
  hasApiKey: boolean;
  languageModelName: string;
  visionModelName: string;
  configured: boolean;
  lastTestStatus: ModelProviderTestStatus;
  lastTestMessage: string;
  languageTestStatus: ModelProviderTestStatus;
  languageTestMessage: string;
  languageTestedAt: string;
  visionTestStatus: ModelProviderTestStatus;
  visionTestMessage: string;
  visionTestedAt: string;
  updatedAt: string;
  testedAt: string;
}

interface ModelProviderChatInput {
  provider: ModelProviderId;
  prompt: string;
  imageDataUrl?: string | null;
}

interface CodexInstallationCheck {
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

interface CliInstallationStatus {
  installed: boolean;
  path: string | null;
  source: 'env' | 'path' | 'nvm' | 'shell' | 'app' | null;
}
