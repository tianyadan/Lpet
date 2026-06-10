import type { ReactElement } from 'react';
import claudeLogoUrl from '../../assets/brands/claude-logo.png';
import codexLogoUrl from '../../assets/brands/codex-logo.png';
import cursorLogoUrl from '../../assets/brands/cursor-logo.png';
import deepseekLogoUrl from '../../assets/model-providers/deepseek-logo.png';
import qwenLogoUrl from '../../assets/model-providers/qwen-logo.png';

export type CliProviderId = 'codex' | 'cursor' | 'claude-code';
export type SettingsMenuKey = 'cli' | 'identity' | 'skin' | 'skills' | 'model-provider' | 'translation' | 'dev-companion';

export interface CliProviderConfig {
  id: CliProviderId;
  name: string;
  commandName: string;
  description: string;
  envName: string;
  statusKey: 'cli' | 'cursor' | 'claudeCode';
  Icon: () => ReactElement;
}

export interface ModelProviderUiConfig {
  id: ModelProviderId;
  name: string;
  description: string;
  defaultModel: string;
  defaultVisionModel?: string;
  logoUrl: string;
}

export const emptyCliStatus: CliInstallationStatus = {
  installed: false,
  path: null,
  source: null,
};

export const emptyStatus: CodexInstallationCheck = {
  cli: emptyCliStatus,
  cursor: emptyCliStatus,
  claudeCode: emptyCliStatus,
  diagnostics: {
    pid: 0,
    homeDir: '',
    configuredCliPath: null,
    configuredCursorPath: null,
    configuredClaudePath: null,
  },
};

export const emptyPetIdentity: PetIdentity = {
  name: '',
  owner: '',
  age: '',
  hobbies: '',
  gender: 'other',
  bio: '',
  updatedAt: '',
};

export const emptyTranslationConfig: TranslationConfig = {
  targetLanguage: 'english',
  shortcut: 'Control+Shift+T',
  updatedAt: '',
};

export const emptyGitActivityConfig: GitActivityConfig = {
  enabled: false,
  translateCommit: false,
  summaryTime: '20:00',
  updatedAt: '',
};

export const emptyGitActivityStatus: GitActivityStatus = {
  wrapperInstalled: false,
  zshrcConfigured: false,
  zprofileConfigured: false,
  bashrcConfigured: false,
  bashProfileConfigured: false,
  currentShellConfigured: false,
  wrapperPath: '',
  recorderPath: '',
  realGitPath: null,
  nodePath: null,
  databasePath: '',
  pathLine: 'export PATH="$HOME/.lpet/bin:$PATH"',
  pathBlock: '',
  config: emptyGitActivityConfig,
  todayStats: { date: '', commitCount: 0, pushCount: 0, repoCount: 0 },
  yesterdayStats: { date: '', commitCount: 0, pushCount: 0, repoCount: 0 },
  recentEvents: [],
};

export const modelProviderUiConfigs: ModelProviderUiConfig[] = [
  {
    id: 'qwen',
    name: '通义千问',
    description: '阿里云 DashScope 兼容 OpenAI 接口的通义千问系列模型。',
    defaultModel: 'qwen-plus',
    defaultVisionModel: 'qwen-vl-plus',
    logoUrl: qwenLogoUrl,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 官方兼容 OpenAI 接口的模型服务。',
    defaultModel: 'deepseek-chat',
    logoUrl: deepseekLogoUrl,
  },
];

export const visionEnabledModelProviders: ModelProviderId[] = ['qwen'];

export const translationLanguageOptions: Array<{ value: TranslationTargetLanguage; label: string }> = [
  { value: 'english', label: '英语' },
  { value: 'chinese', label: '中文' },
  { value: 'russian', label: '俄语' },
  { value: 'french', label: '法语' },
  { value: 'japanese', label: '日本语' },
  { value: 'italian', label: '意大利语' },
];

function createEmptyModelProviderConfig(provider: ModelProviderId): PublicModelProviderConfig {
  return {
    provider,
    hasApiKey: false,
    languageModelName: '',
    visionModelName: '',
    configured: false,
    lastTestStatus: 'unknown',
    lastTestMessage: '',
    languageTestStatus: 'unknown',
    languageTestMessage: '',
    languageTestedAt: '',
    visionTestStatus: 'unknown',
    visionTestMessage: '',
    visionTestedAt: '',
    updatedAt: '',
    testedAt: '',
  };
}

export function createEmptyModelProviderConfigs(): Record<ModelProviderId, PublicModelProviderConfig> {
  return {
    qwen: createEmptyModelProviderConfig('qwen'),
    deepseek: createEmptyModelProviderConfig('deepseek'),
  };
}

export function normalizeGitActivityStatus(status: Partial<GitActivityStatus> | null | undefined): GitActivityStatus {
  return {
    ...emptyGitActivityStatus,
    ...status,
    config: status?.config ?? emptyGitActivityConfig,
    todayStats: status?.todayStats ?? emptyGitActivityStatus.todayStats,
    yesterdayStats: status?.yesterdayStats ?? emptyGitActivityStatus.yesterdayStats,
    recentEvents: Array.isArray(status?.recentEvents) ? status.recentEvents : [],
  };
}

export function sanitizeIdentityDraft(identity: PetIdentity): PetIdentityInput {
  return {
    name: identity.name.trim().slice(0, 40),
    owner: identity.owner.trim().slice(0, 40),
    age: identity.age.trim().slice(0, 20),
    hobbies: identity.hobbies.trim().slice(0, 160),
    gender: identity.gender,
    bio: identity.bio.trim().slice(0, 500),
  };
}

export function BrandPngLogo({ src }: { src: string }) {
  return <img className="settings-cli-logo-image" src={src} alt="" aria-hidden="true" draggable={false} />;
}

function CodexLogo() {
  return <BrandPngLogo src={codexLogoUrl} />;
}

function CursorLogo() {
  return <BrandPngLogo src={cursorLogoUrl} />;
}

function ClaudeLogo() {
  return <BrandPngLogo src={claudeLogoUrl} />;
}

export const cliProviders: CliProviderConfig[] = [
  {
    id: 'codex',
    name: 'Codex',
    commandName: 'codex',
    description: '用于调用本机 Codex CLI 执行问答和代码任务。',
    envName: 'CODEX_CLI_PATH',
    statusKey: 'cli',
    Icon: CodexLogo,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    commandName: 'cursor',
    description: '检测 Cursor CLI，后续可接入 Cursor 相关智能体能力。',
    envName: 'CURSOR_CLI_PATH',
    statusKey: 'cursor',
    Icon: CursorLogo,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    commandName: 'claude',
    description: '检测 Claude Code CLI，后续可接入 Claude Code 执行任务。',
    envName: 'CLAUDE_CLI_PATH',
    statusKey: 'claudeCode',
    Icon: ClaudeLogo,
  },
];

export function getConfiguredPath(status: CodexInstallationCheck, provider: CliProviderConfig): string | null {
  if (provider.id === 'codex') {
    return status.diagnostics.configuredCliPath;
  }
  if (provider.id === 'cursor') {
    return status.diagnostics.configuredCursorPath;
  }
  return status.diagnostics.configuredClaudePath;
}

export function InstallationDot({ installed }: { installed: boolean }) {
  return (
    <span
      className={installed ? 'settings-cli-status-dot settings-cli-status-dot-installed' : 'settings-cli-status-dot'}
      aria-label={installed ? '已检测可用' : '未检测可用'}
    />
  );
}
