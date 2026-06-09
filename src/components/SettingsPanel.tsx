import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import claudeLogoUrl from '../assets/brands/claude-logo.png';
import codexLogoUrl from '../assets/brands/codex-logo.png';
import cursorLogoUrl from '../assets/brands/cursor-logo.png';
import deepseekLogoUrl from '../assets/model-providers/deepseek-logo.png';
import qwenLogoUrl from '../assets/model-providers/qwen-logo.png';

interface SettingsPanelProps {
  isOpen: boolean;
  petSkins: PetSkinOption[];
  selectedPetSkinId: string;
  onPetSkinSelect: (skinId: string) => void;
  onPetSkinImport: () => Promise<PetSkinOption | null>;
  skills: LocalSkill[];
  onSkillEnabledChange: (skillId: string, enabled: boolean) => void;
  onClose: () => void;
}

type CliProviderId = 'codex' | 'cursor' | 'claude-code';
type SettingsMenuKey = 'cli' | 'identity' | 'skin' | 'skills' | 'model-provider' | 'translation' | 'dev-companion';

interface CliProviderConfig {
  id: CliProviderId;
  name: string;
  commandName: string;
  description: string;
  envName: string;
  statusKey: 'cli' | 'cursor' | 'claudeCode';
  Icon: () => ReactElement;
}

interface ModelProviderUiConfig {
  id: ModelProviderId;
  name: string;
  description: string;
  defaultModel: string;
  defaultVisionModel?: string;
  logoUrl: string;
}

const emptyCliStatus: CliInstallationStatus = {
  installed: false,
  path: null,
  source: null,
};

const emptyStatus: CodexInstallationCheck = {
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

const emptyPetIdentity: PetIdentity = {
  name: '',
  owner: '',
  age: '',
  hobbies: '',
  gender: 'other',
  bio: '',
  updatedAt: '',
};

const modelProviderUiConfigs: ModelProviderUiConfig[] = [
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
const visionEnabledModelProviders: ModelProviderId[] = ['qwen'];
const translationLanguageOptions: Array<{ value: TranslationTargetLanguage; label: string }> = [
  { value: 'english', label: '英语' },
  { value: 'chinese', label: '中文' },
  { value: 'russian', label: '俄语' },
  { value: 'french', label: '法语' },
  { value: 'japanese', label: '日本语' },
  { value: 'italian', label: '意大利语' },
];
const emptyTranslationConfig: TranslationConfig = {
  targetLanguage: 'english',
  shortcut: 'Control+Shift+T',
  updatedAt: '',
};
const emptyGitActivityConfig: GitActivityConfig = {
  enabled: false,
  translateCommit: false,
  summaryTime: '20:00',
  updatedAt: '',
};
const emptyGitActivityStatus: GitActivityStatus = {
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

function createEmptyModelProviderConfigs(): Record<ModelProviderId, PublicModelProviderConfig> {
  return {
    qwen: createEmptyModelProviderConfig('qwen'),
    deepseek: createEmptyModelProviderConfig('deepseek'),
  };
}

function normalizeGitActivityStatus(status: Partial<GitActivityStatus> | null | undefined): GitActivityStatus {
  return {
    ...emptyGitActivityStatus,
    ...status,
    config: status?.config ?? emptyGitActivityConfig,
    todayStats: status?.todayStats ?? emptyGitActivityStatus.todayStats,
    yesterdayStats: status?.yesterdayStats ?? emptyGitActivityStatus.yesterdayStats,
    recentEvents: Array.isArray(status?.recentEvents) ? status.recentEvents : [],
  };
}

function BrandPngLogo({ src }: { src: string }) {
  return (
    <img className="settings-cli-logo-image" src={src} alt="" aria-hidden="true" draggable={false} />
  );
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

const cliProviders: CliProviderConfig[] = [
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

function getConfiguredPath(status: CodexInstallationCheck, provider: CliProviderConfig): string | null {
  if (provider.id === 'codex') {
    return status.diagnostics.configuredCliPath;
  }
  if (provider.id === 'cursor') {
    return status.diagnostics.configuredCursorPath;
  }
  return status.diagnostics.configuredClaudePath;
}

function InstallationDot({ installed }: { installed: boolean }) {
  return (
    <span
      className={installed ? 'settings-cli-status-dot settings-cli-status-dot-installed' : 'settings-cli-status-dot'}
      aria-label={installed ? '已检测可用' : '未检测可用'}
    />
  );
}

function CliProviderCard({
  provider,
  status,
  onSelect,
}: {
  provider: CliProviderConfig;
  status: CliInstallationStatus;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="settings-cli-card" onClick={onSelect}>
      <div className="settings-cli-logo-wrap">
        <provider.Icon />
        <InstallationDot installed={status.installed} />
      </div>
      <span className="settings-cli-name">{provider.name}</span>
    </button>
  );
}

function CliProviderDetail({
  provider,
  status,
  configuredPath,
  diagnostics,
  isChecking,
  lastCheckedAt,
  errorMessage,
  onBack,
  onRefresh,
}: {
  provider: CliProviderConfig;
  status: CliInstallationStatus;
  configuredPath: string | null;
  diagnostics: CodexInstallationCheck['diagnostics'];
  isChecking: boolean;
  lastCheckedAt: string;
  errorMessage: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="settings-cli-detail" aria-label={`${provider.name} CLI 详情`}>
      <button type="button" className="settings-back-button" onClick={onBack}>
        返回
      </button>

      <div className="settings-cli-detail-header">
        <div className="settings-cli-logo-wrap settings-cli-logo-wrap-large">
          <provider.Icon />
          <InstallationDot installed={status.installed} />
        </div>
        <div>
          <h3>{provider.name}</h3>
          <p>{provider.description}</p>
        </div>
      </div>

      <div className="settings-installation-meta settings-installation-meta-detail">
        <span className={status.installed ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>
          {status.installed ? '已安装' : '未检测到'}
        </span>
        {status.source && <span className="settings-installation-source">来源：{status.source}</span>}
        <span className="settings-installation-path">{status.path ?? '无可用路径'}</span>
      </div>

      <div className="settings-diagnostics">
        <span>命令：{provider.commandName}</span>
        <span>环境变量：{provider.envName}</span>
        <span>{provider.envName}：{configuredPath ?? '未配置'}</span>
        <span>进程：{diagnostics.pid || '未知'}</span>
      </div>

      {errorMessage && <div className="settings-error">{errorMessage}</div>}
      {lastCheckedAt && <div className="settings-check-time">上次检测：{lastCheckedAt}</div>}

      <button type="button" className="settings-refresh-button" disabled={isChecking} onClick={onRefresh}>
        {isChecking ? '检测中' : '重新检测'}
      </button>
    </section>
  );
}

function ModelProviderCard({
  provider,
  config,
  onSelect,
}: {
  provider: ModelProviderUiConfig;
  config: PublicModelProviderConfig;
  onSelect: () => void;
}) {
  const isAvailable = config.languageTestStatus === 'success';

  return (
    <button type="button" className="settings-cli-card settings-model-provider-card" onClick={onSelect}>
      <div className="settings-cli-logo-wrap">
        <BrandPngLogo src={provider.logoUrl} />
        <InstallationDot installed={isAvailable} />
      </div>
      <span className="settings-cli-name">{provider.name}</span>
    </button>
  );
}

function ModelProviderDetail({
  provider,
  config,
  draft,
  isSaving,
  isTesting,
  message,
  onBack,
  onDraftChange,
  onSave,
  onTest,
}: {
  provider: ModelProviderUiConfig;
  config: PublicModelProviderConfig;
  draft: ModelProviderConfigInput;
  isSaving: boolean;
  isTesting: boolean;
  message: string;
  onBack: () => void;
  onDraftChange: (draft: ModelProviderConfigInput) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const supportsVision = visionEnabledModelProviders.includes(provider.id);
  const isAvailable = config.languageTestStatus === 'success';
  const statusText =
    isAvailable
      ? '连接通过'
      : config.lastTestStatus === 'failed'
        ? '测试失败'
        : config.configured
          ? '已配置'
          : '未配置';

  return (
    <section className="settings-cli-detail" aria-label={`${provider.name} 模型供应商详情`}>
      <button type="button" className="settings-back-button" onClick={onBack}>
        返回
      </button>

      <div className="settings-cli-detail-header">
        <div className="settings-cli-logo-wrap settings-cli-logo-wrap-large">
          <BrandPngLogo src={provider.logoUrl} />
          <InstallationDot installed={isAvailable} />
        </div>
        <div>
          <h3>{provider.name}</h3>
          <p>{provider.description}</p>
        </div>
      </div>

      <div className="settings-form-grid settings-model-form-grid">
        <label className="settings-field">
          <span>API Key</span>
          <input
            type="password"
            value={draft.apiKey ?? ''}
            placeholder={config.hasApiKey ? '已保存，留空则不修改' : '请输入 API Key'}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                apiKey: event.target.value,
              })
            }
          />
        </label>
        <label className="settings-field">
          <span>语言模型</span>
          <input
            value={draft.languageModelName}
            placeholder={provider.defaultModel}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                languageModelName: event.target.value,
              })
            }
          />
        </label>
        {supportsVision && (
          <label className="settings-field">
            <span>多模态模型</span>
            <input
              value={draft.visionModelName ?? ''}
              placeholder={provider.defaultVisionModel ?? 'qwen-vl-plus'}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  visionModelName: event.target.value,
                })
              }
            />
          </label>
        )}
      </div>

      <div className="settings-installation-meta settings-installation-meta-detail">
        <span className={isAvailable ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>
          {statusText}
        </span>
        <span className="settings-installation-path">语言模型：{config.languageModelName || '未配置'}</span>
        {supportsVision && <span className="settings-installation-path">多模态模型：{config.visionModelName || '未配置'}</span>}
        <span className="settings-installation-source">
          语言模型：{config.languageTestStatus === 'success' ? '已通过' : config.languageTestStatus === 'failed' ? '失败' : '未检测'}
        </span>
        {supportsVision && (
          <span className="settings-installation-source">
            多模态模型：{config.visionTestStatus === 'success' ? '已通过' : config.visionTestStatus === 'failed' ? '失败' : '未检测'}
          </span>
        )}
        {config.testedAt && <span className="settings-installation-source">上次测试：{new Date(config.testedAt).toLocaleString()}</span>}
      </div>

      {message && (
        <div className={message.includes('通过') || message.includes('保存') ? 'settings-success' : 'settings-error'}>
          {message}
        </div>
      )}

      <div className="settings-section-actions settings-model-actions">
        <button type="button" className="settings-secondary-button" disabled={isSaving || isTesting} onClick={onSave}>
          {isSaving ? '保存中' : '保存配置'}
        </button>
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isSaving || isTesting} onClick={onTest}>
          {isTesting ? '测试中' : '测试链接'}
        </button>
      </div>
    </section>
  );
}

function sanitizeIdentityDraft(identity: PetIdentity): PetIdentityInput {
  return {
    name: identity.name.trim().slice(0, 40),
    owner: identity.owner.trim().slice(0, 40),
    age: identity.age.trim().slice(0, 20),
    hobbies: identity.hobbies.trim().slice(0, 160),
    gender: identity.gender,
    bio: identity.bio.trim().slice(0, 500),
  };
}

function PetIdentityPanel({
  identity,
  isEditing,
  isSaving,
  errorMessage,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: {
  identity: PetIdentity;
  isEditing: boolean;
  isSaving: boolean;
  errorMessage: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (identity: PetIdentity) => void;
}) {
  function updateField<K extends keyof PetIdentity>(field: K, value: PetIdentity[K]) {
    onChange({
      ...identity,
      [field]: value,
    });
  }

  return (
    <section className="settings-identity" aria-label="宠物身份">
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">宠物身份</div>
          <p>这些信息会随每次对话传给智能体，用来保持桌宠人格一致。</p>
        </div>
        <div className="settings-section-actions">
          {isEditing ? (
            <>
              <button type="button" className="settings-secondary-button" disabled={isSaving} onClick={onCancel}>
                取消
              </button>
              <button type="button" className="settings-refresh-button settings-save-button" disabled={isSaving} onClick={onSave}>
                {isSaving ? '保存中' : '保存'}
              </button>
            </>
          ) : (
            <button type="button" className="settings-refresh-button settings-save-button" onClick={onEdit}>
              编辑
            </button>
          )}
        </div>
      </div>

      <div className="settings-form-grid">
        <label className="settings-field">
          <span>名字</span>
          <input
            value={identity.name}
            disabled={!isEditing}
            maxLength={40}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>主人</span>
          <input
            value={identity.owner}
            disabled={!isEditing}
            maxLength={40}
            onChange={(event) => updateField('owner', event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>年龄</span>
          <input
            value={identity.age}
            disabled={!isEditing}
            maxLength={20}
            onChange={(event) => updateField('age', event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>爱好</span>
          <input
            value={identity.hobbies}
            disabled={!isEditing}
            maxLength={160}
            onChange={(event) => updateField('hobbies', event.target.value)}
          />
        </label>
      </div>

      <fieldset className="settings-gender-field" disabled={!isEditing}>
        <legend>性别</legend>
        {[
          { value: 'male', label: '男' },
          { value: 'female', label: '女' },
          { value: 'other', label: '其他' },
        ].map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="pet-gender"
              value={option.value}
              checked={identity.gender === option.value}
              onChange={() => updateField('gender', option.value as PetGender)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="settings-field settings-rich-field">
        <span>简介</span>
        <div
          className={isEditing ? 'settings-rich-editor' : 'settings-rich-editor settings-rich-editor-disabled'}
          contentEditable={isEditing}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={(event) => {
            const nextText = event.currentTarget.innerText.slice(0, 500);
            updateField('bio', nextText);
          }}
        >
          {identity.bio}
        </div>
        <small>{identity.bio.length}/500</small>
      </label>

      {errorMessage && <div className="settings-error">{errorMessage}</div>}
      {identity.updatedAt && <div className="settings-check-time">上次保存：{new Date(identity.updatedAt).toLocaleString()}</div>}
    </section>
  );
}

function TranslationPanel({
  config,
  draft,
  isSaving,
  message,
  hasAvailableModelProvider,
  hasCodexCli,
  onChange,
  onSave,
}: {
  config: TranslationConfig;
  draft: TranslationConfigInput;
  isSaving: boolean;
  message: string;
  hasAvailableModelProvider: boolean;
  hasCodexCli: boolean;
  onChange: (draft: TranslationConfigInput) => void;
  onSave: () => void;
}) {
  const routeText = hasAvailableModelProvider
    ? '优先使用已通过测试的模型供应商；模型不可用时回退 Codex CLI。'
    : hasCodexCli
      ? '当前没有可用模型供应商，将回退使用 Codex CLI。'
      : '当前没有可用模型供应商，也未检测到 Codex CLI，快捷翻译暂不可用。';

  return (
    <section className="settings-translation" aria-label="翻译设置">
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">翻译</div>
          <p>选中文字后按快捷键，桌宠会快速翻译并把结果显示在回复气泡中。</p>
        </div>
      </div>

      <div className="settings-form-grid">
        <label className="settings-field">
          <span>目标语言</span>
          <select
            value={draft.targetLanguage}
            onChange={(event) =>
              onChange({
                ...draft,
                targetLanguage: event.target.value as TranslationTargetLanguage,
              })
            }
          >
            {translationLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>快捷键</span>
          <input
            value={draft.shortcut}
            placeholder="Control+Shift+T"
            onChange={(event) =>
              onChange({
                ...draft,
                shortcut: event.target.value,
              })
            }
          />
        </label>
      </div>

      <div className="settings-installation-meta settings-installation-meta-detail">
        <span className={hasAvailableModelProvider || hasCodexCli ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>
          {hasAvailableModelProvider || hasCodexCli ? '可用' : '不可用'}
        </span>
        <span className="settings-installation-source">{routeText}</span>
        <span className="settings-installation-path">Electron 快捷键格式示例：Control+Shift+T、CommandOrControl+Shift+Y</span>
        <span className="settings-installation-path">macOS 首次使用需要给当前终端或 Electron 开启“辅助功能”权限，用于读取其他 App 中选中的文字。</span>
        {config.updatedAt && <span className="settings-installation-source">上次保存：{new Date(config.updatedAt).toLocaleString()}</span>}
      </div>

      {message && (
        <div className={message.includes('保存') ? 'settings-success' : 'settings-error'}>
          {message}
        </div>
      )}

      <div className="settings-section-actions">
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isSaving} onClick={onSave}>
          {isSaving ? '保存中' : '保存翻译配置'}
        </button>
      </div>
    </section>
  );
}

function DevelopmentCompanionPanel({
  config,
  status,
  isSaving,
  isInstalling,
  message,
  onChange,
  onSave,
  onInstall,
  onRefresh,
}: {
  config: GitActivityConfig;
  status: GitActivityStatus;
  isSaving: boolean;
  isInstalling: boolean;
  message: string;
  onChange: (config: GitActivityConfig) => void;
  onSave: () => void;
  onInstall: () => void;
  onRefresh: () => void;
}) {
  const hasShellProfileConfigured =
    status.zshrcConfigured || status.zprofileConfigured || status.bashrcConfigured || status.bashProfileConfigured;
  const ready = status.wrapperInstalled && hasShellProfileConfigured;
  const comparisonText =
    status.todayStats.pushCount > status.yesterdayStats.pushCount
      ? '今天 push 比昨天多，推进力度更强。'
      : status.todayStats.pushCount === status.yesterdayStats.pushCount
        ? '今天 push 和昨天持平。'
        : '今天 push 少于昨天，晚上会提醒你关注节奏。';

  return (
    <section className="settings-dev-companion" aria-label="开发陪伴">
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">开发陪伴</div>
          <p>全局拦截终端里的 git commit / git push，记录到本地 SQLite，并让桌宠用气泡反馈今天的开发节奏。</p>
        </div>
      </div>

      <div className="settings-installation-meta settings-installation-meta-detail">
        <span className={ready ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>
          {ready ? '已接入' : '未接入'}
        </span>
        <span className="settings-installation-source">
          点击“一键安装并写入”会创建 {status.wrapperPath || '~/.lpet/bin/git'}，并向常用 shell 配置写入 PATH。
        </span>
        <span className="settings-installation-source">Cursor 里已打开的终端不会自动刷新 PATH，请关闭当前终端标签后重新打开。</span>
      </div>

      <div className="settings-form-grid settings-model-form-grid">
        <label className="settings-toggle-row settings-toggle-row-block">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
          />
          <span>启用 Git 全局统计</span>
        </label>
        <label className="settings-toggle-row settings-toggle-row-block">
          <input
            type="checkbox"
            checked={config.translateCommit}
            onChange={(event) => onChange({ ...config, translateCommit: event.target.checked })}
          />
          <span>Commit 信息转中文（后续接入模型后会消耗 Token）</span>
        </label>
        <label className="settings-field">
          <span>每日总结时间</span>
          <input
            type="time"
            value={config.summaryTime}
            onChange={(event) => onChange({ ...config, summaryTime: event.target.value || '20:00' })}
          />
        </label>
      </div>

      <div className="settings-dev-stats">
        <div>
          <strong>{status.todayStats.commitCount}</strong>
          <span>今日 commit</span>
        </div>
        <div>
          <strong>{status.todayStats.pushCount}</strong>
          <span>今日 push</span>
        </div>
        <div>
          <strong>{status.todayStats.repoCount}</strong>
          <span>涉及仓库</span>
        </div>
      </div>
      <div className="settings-check-time">{comparisonText}</div>

      <div className="settings-diagnostics settings-dev-diagnostics">
        <span>Wrapper：{status.wrapperInstalled ? '已安装' : '未安装'} · {status.wrapperPath || '未知'}</span>
        <span>Shell PATH：{hasShellProfileConfigured ? '已写入 shell profile' : '未写入 shell profile'}</span>
        <span>.zshrc：{status.zshrcConfigured ? '已写入' : '未写入'} · .zprofile：{status.zprofileConfigured ? '已写入' : '未写入'}</span>
        <span>.bashrc：{status.bashrcConfigured ? '已写入' : '未写入'} · .bash_profile：{status.bashProfileConfigured ? '已写入' : '未写入'}</span>
        <span>当前进程 PATH：{status.currentShellConfigured ? '已包含 ~/.lpet/bin' : '未包含 ~/.lpet/bin'}</span>
        <span>真实 Git：{status.realGitPath ?? '未检测到'}</span>
        <span>Node：{status.nodePath ?? '未检测到'}</span>
        <span>SQLite：{status.databasePath || '未知'}</span>
      </div>

      {status.recentEvents.length > 0 && (
        <div className="settings-dev-events">
          {status.recentEvents.slice(0, 4).map((event) => (
            <div key={event.id}>
              <span>{event.eventType}</span>
              <strong>{event.commitMessage || event.remote || '已记录'}</strong>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className={message.includes('成功') || message.includes('保存') ? 'settings-success' : 'settings-error'}>
          {message}
        </div>
      )}

      <div className="settings-section-actions settings-model-actions">
        <button type="button" className="settings-secondary-button" disabled={isInstalling} onClick={onRefresh}>
          刷新状态
        </button>
        <button type="button" className="settings-secondary-button" disabled={isSaving} onClick={onSave}>
          {isSaving ? '保存中' : '保存配置'}
        </button>
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isInstalling} onClick={onInstall}>
          {isInstalling ? '安装中' : '一键安装并写入'}
        </button>
      </div>
    </section>
  );
}

function SkinPanel({
  skins,
  selectedSkinId,
  isImporting,
  message,
  onSelect,
  onImport,
}: {
  skins: PetSkinOption[];
  selectedSkinId: string;
  isImporting: boolean;
  message: string;
  onSelect: (skinId: string) => void;
  onImport: () => void;
}) {
  return (
    <section className="settings-skin" aria-label="皮肤">
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">皮肤</div>
          <p>选择当前桌宠外观。皮肤需要兼容 Codex 桌宠 8x9 spritesheet 动画协议。</p>
        </div>
      </div>

      <div className="settings-skin-grid">
        {skins.map((skin) => (
          <button
            key={skin.id}
            type="button"
            className={skin.id === selectedSkinId ? 'settings-skin-card settings-skin-card-active' : 'settings-skin-card'}
            onClick={() => onSelect(skin.id)}
          >
            <span className="settings-skin-preview" style={{ backgroundImage: `url(${skin.spritesheetUrl})` }} />
            <span className="settings-skin-info">
              <strong>{skin.displayName}</strong>
              <small>{skin.source === 'built-in' ? '内置皮肤' : '导入皮肤'}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="settings-import-hint">
        <strong>导入说明</strong>
        <span>点击“导入皮肤”后，请选择一个 Codex 适配的皮肤父文件夹；如果下载的是 zip，请先解压。</span>
        <span>该文件夹必须包含：`pet.json` 和 `spritesheet.webp`。</span>
        <span>`pet.json` 需要声明 `id`、`displayName`、`description`、`spritesheetPath`。</span>
        <span>`spritesheet.webp` 需为 8 列 x 9 行图集，每帧 192 x 208，按当前 Codex 动画行协议排列。</span>
      </div>

      {message && (
        <div className={message.includes('成功') || message.includes('已导入') ? 'settings-success' : 'settings-error'}>
          {message}
        </div>
      )}

      <div className="settings-section-actions">
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isImporting} onClick={onImport}>
          {isImporting ? '导入中' : '导入皮肤'}
        </button>
      </div>
    </section>
  );
}

function SkillsPanel({
  skills,
  selectedSkillId,
  onSelect,
  onEnabledChange,
}: {
  skills: LocalSkill[];
  selectedSkillId: string | null;
  onSelect: (skillId: string) => void;
  onEnabledChange: (skillId: string, enabled: boolean) => void;
}) {
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? skills[0] ?? null;

  return (
    <section className="settings-skills" aria-label="Skills">
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">Skills</div>
          <p>管理本地已安装的 Skills。禁用后，双击快捷输入中输入 `/` 不再显示该 Skill。</p>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="settings-empty-state">未发现本地 Skills。</div>
      ) : (
        <>
          <div className="settings-skill-grid">
            {skills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={skill.id === selectedSkill?.id ? 'settings-skill-card settings-skill-card-active' : 'settings-skill-card'}
                onClick={() => onSelect(skill.id)}
              >
                <span className={skill.enabled ? 'settings-skill-status settings-skill-status-enabled' : 'settings-skill-status'} />
                <strong>{skill.name}</strong>
                <small>{skill.source}</small>
              </button>
            ))}
          </div>

          {selectedSkill && (
            <div className="settings-skill-detail">
              <div>
                <strong>{selectedSkill.name}</strong>
                <span>{selectedSkill.source}</span>
              </div>
              <p>{selectedSkill.description || '这个 Skill 暂无简介。'}</p>
              <code>{selectedSkill.entryPath}</code>
              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={selectedSkill.enabled}
                  onChange={(event) => onEnabledChange(selectedSkill.id, event.target.checked)}
                />
                <span>{selectedSkill.enabled ? '已启用' : '已禁用'}</span>
              </label>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function SettingsPanel({
  isOpen,
  petSkins,
  selectedPetSkinId,
  onPetSkinSelect,
  onPetSkinImport,
  skills,
  onSkillEnabledChange,
  onClose,
}: SettingsPanelProps) {
  const [status, setStatus] = useState<CodexInstallationCheck>(emptyStatus);
  const [activeMenu, setActiveMenu] = useState<SettingsMenuKey>('cli');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<CliProviderId | null>(null);
  const [petIdentity, setPetIdentity] = useState<PetIdentity>(emptyPetIdentity);
  const [identityDraft, setIdentityDraft] = useState<PetIdentity>(emptyPetIdentity);
  const [isIdentityEditing, setIsIdentityEditing] = useState(false);
  const [isIdentitySaving, setIsIdentitySaving] = useState(false);
  const [identityErrorMessage, setIdentityErrorMessage] = useState('');
  const [modelProviderConfigs, setModelProviderConfigs] = useState<Record<ModelProviderId, PublicModelProviderConfig>>(
    createEmptyModelProviderConfigs,
  );
  const [selectedModelProviderId, setSelectedModelProviderId] = useState<ModelProviderId | null>(null);
  const [modelProviderDraft, setModelProviderDraft] = useState<ModelProviderConfigInput>({
    provider: 'qwen',
    apiKey: '',
    languageModelName: 'qwen-plus',
    visionModelName: '',
  });
  const [isModelProviderSaving, setIsModelProviderSaving] = useState(false);
  const [isModelProviderTesting, setIsModelProviderTesting] = useState(false);
  const [modelProviderMessage, setModelProviderMessage] = useState('');
  const [translationConfig, setTranslationConfig] = useState<TranslationConfig>(emptyTranslationConfig);
  const [translationDraft, setTranslationDraft] = useState<TranslationConfigInput>(emptyTranslationConfig);
  const [isTranslationSaving, setIsTranslationSaving] = useState(false);
  const [translationMessage, setTranslationMessage] = useState('');
  const [gitActivityConfig, setGitActivityConfig] = useState<GitActivityConfig>(emptyGitActivityConfig);
  const [gitActivityStatus, setGitActivityStatus] = useState<GitActivityStatus>(emptyGitActivityStatus);
  const [isGitActivitySaving, setIsGitActivitySaving] = useState(false);
  const [isGitActivityInstalling, setIsGitActivityInstalling] = useState(false);
  const [gitActivityMessage, setGitActivityMessage] = useState('');
  const [isSkinImporting, setIsSkinImporting] = useState(false);
  const [skinMessage, setSkinMessage] = useState('');
  const [selectedSettingsSkillId, setSelectedSettingsSkillId] = useState<string | null>(null);
  const selectedProvider = useMemo(
    () => cliProviders.find((provider) => provider.id === selectedProviderId) ?? null,
    [selectedProviderId],
  );
  const selectedModelProvider = useMemo(
    () => modelProviderUiConfigs.find((provider) => provider.id === selectedModelProviderId) ?? null,
    [selectedModelProviderId],
  );

  async function refreshStatus() {
    setIsChecking(true);
    setErrorMessage('');

    try {
      if (!window.petDesktop) {
        setErrorMessage('Electron preload 未加载，无法调用主进程检测。请重启桌宠进程。');
        return;
      }

      const nextStatus = await window.petDesktop.checkCodexInstallations();
      setStatus(nextStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    } finally {
      setLastCheckedAt(new Date().toLocaleTimeString());
      setIsChecking(false);
    }
  }

  async function refreshPetIdentity() {
    try {
      if (!window.petDesktop) {
        setIdentityErrorMessage('Electron preload 未加载，无法读取宠物身份。请重启桌宠进程。');
        return;
      }

      const nextIdentity = await window.petDesktop.getPetIdentity();
      setPetIdentity(nextIdentity);
      setIdentityDraft(nextIdentity);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIdentityErrorMessage(message);
    }
  }

  async function refreshModelProviderConfigs() {
    try {
      if (!window.petDesktop) {
        setModelProviderMessage('Electron preload 未加载，无法读取模型供应商配置。请重启桌宠进程。');
        return;
      }

      const configs = await window.petDesktop.listModelProviderConfigs();
      setModelProviderConfigs((current) => {
        const nextConfigs = { ...current };
        for (const config of configs) {
          nextConfigs[config.provider] = config;
        }
        return nextConfigs;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelProviderMessage(message);
    }
  }

  async function refreshTranslationConfig() {
    try {
      if (!window.petDesktop) {
        setTranslationMessage('Electron preload 未加载，无法读取翻译配置。请重启桌宠进程。');
        return;
      }

      const nextConfig = await window.petDesktop.getTranslationConfig();
      setTranslationConfig(nextConfig);
      setTranslationDraft({
        targetLanguage: nextConfig.targetLanguage,
        shortcut: nextConfig.shortcut,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTranslationMessage(message);
    }
  }

  async function refreshGitActivityStatus() {
    try {
      if (!window.petDesktop) {
        setGitActivityMessage('Electron preload 未加载，无法读取开发陪伴配置。请重启桌宠进程。');
        return;
      }

      const nextStatus = await window.petDesktop.getGitActivityStatus();
      const normalizedStatus = normalizeGitActivityStatus(nextStatus);
      setGitActivityStatus(normalizedStatus);
      setGitActivityConfig(normalizedStatus.config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitActivityMessage(message);
    }
  }

  async function savePetIdentity() {
    setIsIdentitySaving(true);
    setIdentityErrorMessage('');

    try {
      if (!window.petDesktop) {
        setIdentityErrorMessage('Electron preload 未加载，无法保存宠物身份。请重启桌宠进程。');
        return;
      }

      const savedIdentity = await window.petDesktop.savePetIdentity(sanitizeIdentityDraft(identityDraft));
      setPetIdentity(savedIdentity);
      setIdentityDraft(savedIdentity);
      setIsIdentityEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIdentityErrorMessage(message);
    } finally {
      setIsIdentitySaving(false);
    }
  }

  async function saveModelProviderConfig() {
    setIsModelProviderSaving(true);
    setModelProviderMessage('');

    try {
      if (!window.petDesktop) {
        setModelProviderMessage('Electron preload 未加载，无法保存模型供应商配置。请重启桌宠进程。');
        return;
      }

      const savedConfig = await window.petDesktop.saveModelProviderConfig(modelProviderDraft);
      setModelProviderConfigs((current) => ({
        ...current,
        [savedConfig.provider]: savedConfig,
      }));
      setModelProviderDraft({
        provider: savedConfig.provider,
        apiKey: '',
        languageModelName: savedConfig.languageModelName,
        visionModelName: savedConfig.visionModelName,
      });
      setModelProviderMessage('配置已保存。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelProviderMessage(message);
    } finally {
      setIsModelProviderSaving(false);
    }
  }

  async function testModelProviderConnection() {
    setIsModelProviderTesting(true);
    setModelProviderMessage('');

    try {
      if (!window.petDesktop) {
        setModelProviderMessage('Electron preload 未加载，无法测试模型供应商。请重启桌宠进程。');
        return;
      }

      const testedConfig = await window.petDesktop.testModelProviderConnection(modelProviderDraft);
      setModelProviderConfigs((current) => ({
        ...current,
        [testedConfig.provider]: testedConfig,
      }));
      setModelProviderDraft({
        provider: testedConfig.provider,
        apiKey: '',
        languageModelName: testedConfig.languageModelName,
        visionModelName: testedConfig.visionModelName,
      });
      setModelProviderMessage('连接测试通过。');
      void refreshModelProviderConfigs();
    } catch {
      setModelProviderMessage('测试失败，请检查 API Key、语言模型或多模态模型名称。');
      void refreshModelProviderConfigs();
    } finally {
      setIsModelProviderTesting(false);
    }
  }

  async function saveTranslationConfig() {
    setIsTranslationSaving(true);
    setTranslationMessage('');

    try {
      if (!window.petDesktop) {
        setTranslationMessage('Electron preload 未加载，无法保存翻译配置。请重启桌宠进程。');
        return;
      }

      const savedConfig = await window.petDesktop.saveTranslationConfig({
        targetLanguage: translationDraft.targetLanguage,
        shortcut: translationDraft.shortcut.trim() || 'Control+Shift+T',
      });
      setTranslationConfig(savedConfig);
      setTranslationDraft({
        targetLanguage: savedConfig.targetLanguage,
        shortcut: savedConfig.shortcut,
      });
      setTranslationMessage('翻译配置已保存。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTranslationMessage(message);
    } finally {
      setIsTranslationSaving(false);
    }
  }

  async function saveGitActivityConfig() {
    setIsGitActivitySaving(true);
    setGitActivityMessage('');

    try {
      if (!window.petDesktop) {
        setGitActivityMessage('Electron preload 未加载，无法保存开发陪伴配置。请重启桌宠进程。');
        return;
      }

      const savedConfig = await window.petDesktop.saveGitActivityConfig({
        enabled: gitActivityConfig.enabled,
        translateCommit: gitActivityConfig.translateCommit,
        summaryTime: gitActivityConfig.summaryTime,
      });
      setGitActivityConfig(savedConfig);
      setGitActivityMessage('开发陪伴配置已保存。');
      void refreshGitActivityStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitActivityMessage(message);
    } finally {
      setIsGitActivitySaving(false);
    }
  }

  async function installGitActivity() {
    setIsGitActivityInstalling(true);
    setGitActivityMessage('');

    try {
      if (!window.petDesktop) {
        setGitActivityMessage('Electron preload 未加载，无法安装 Git 统计入口。请重启桌宠进程。');
        return;
      }

      const nextStatus = await window.petDesktop.installGitActivity();
      const normalizedStatus = normalizeGitActivityStatus(nextStatus);
      setGitActivityStatus(normalizedStatus);
      setGitActivityConfig(normalizedStatus.config);
      setGitActivityMessage('安装成功。请重新打开终端，之后 git commit / git push 会自动记录。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitActivityMessage(message);
    } finally {
      setIsGitActivityInstalling(false);
    }
  }

  async function importPetSkin() {
    setIsSkinImporting(true);
    setSkinMessage('');

    try {
      const importedSkin = await onPetSkinImport();
      if (importedSkin) {
        setSkinMessage(`已导入并切换到 ${importedSkin.displayName}。`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSkinMessage(message);
    } finally {
      setIsSkinImporting(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedProviderId(null);
      setSelectedModelProviderId(null);
      setActiveMenu('cli');
      setIdentityErrorMessage('');
      setModelProviderMessage('');
      setTranslationMessage('');
      setGitActivityMessage('');
      setSkinMessage('');
      setSelectedSettingsSkillId(null);
      setIsIdentityEditing(false);
      void refreshStatus();
      void refreshPetIdentity();
      void refreshModelProviderConfigs();
      void refreshTranslationConfig();
      void refreshGitActivityStatus();
    }
  }, [isOpen]);

  const hasAvailableTranslationModelProvider = Object.values(modelProviderConfigs).some(
    (config) => config.languageTestStatus === 'success' && config.hasApiKey && config.languageModelName,
  );

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="settings-panel" aria-label="设置">
      <header className="codex-panel-header">
        <span>设置</span>
        <button type="button" className="codex-icon-button" onClick={onClose} aria-label="关闭设置">
          ×
        </button>
      </header>

      <div className="settings-layout">
        <nav className="settings-sidebar" aria-label="设置菜单">
          <button
            type="button"
            className={activeMenu === 'cli' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('cli');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
            }}
          >
            配置 CLI
          </button>
          <button
            type="button"
            className={activeMenu === 'identity' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('identity');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
            }}
          >
            宠物身份
          </button>
          <button
            type="button"
            className={activeMenu === 'skin' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('skin');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
              setSkinMessage('');
            }}
          >
            皮肤
          </button>
          <button
            type="button"
            className={activeMenu === 'skills' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('skills');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
              setSelectedSettingsSkillId((current) => current ?? skills[0]?.id ?? null);
            }}
          >
            Skills
          </button>
          <button
            type="button"
            className={activeMenu === 'model-provider' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('model-provider');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
              setModelProviderMessage('');
            }}
          >
            模型供应商
          </button>
          <button
            type="button"
            className={activeMenu === 'translation' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('translation');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
              setTranslationMessage('');
            }}
          >
            翻译
          </button>
          <button
            type="button"
            className={activeMenu === 'dev-companion' ? 'settings-sidebar-item settings-sidebar-item-active' : 'settings-sidebar-item'}
            onClick={() => {
              setActiveMenu('dev-companion');
              setSelectedProviderId(null);
              setSelectedModelProviderId(null);
              setGitActivityMessage('');
              void refreshGitActivityStatus();
            }}
          >
            开发陪伴
          </button>
        </nav>

        <div className="settings-panel-body">
          {activeMenu === 'cli' && !selectedProvider && (
            <section className="settings-cli-overview" aria-label="配置 CLI">
              <div className="settings-section-title">配置 CLI</div>
              <div className="settings-cli-grid">
                {cliProviders.map((provider) => (
                  <CliProviderCard
                    key={provider.id}
                    provider={provider}
                    status={status[provider.statusKey]}
                    onSelect={() => setSelectedProviderId(provider.id)}
                  />
                ))}
              </div>
              {errorMessage && <div className="settings-error">{errorMessage}</div>}
              {lastCheckedAt && <div className="settings-check-time">上次检测：{lastCheckedAt}</div>}
            </section>
          )}

          {activeMenu === 'cli' && selectedProvider && (
            <CliProviderDetail
              provider={selectedProvider}
              status={status[selectedProvider.statusKey]}
              configuredPath={getConfiguredPath(status, selectedProvider)}
              diagnostics={status.diagnostics}
              isChecking={isChecking}
              lastCheckedAt={lastCheckedAt}
              errorMessage={errorMessage}
              onBack={() => setSelectedProviderId(null)}
              onRefresh={refreshStatus}
            />
          )}

          {activeMenu === 'identity' && (
            <PetIdentityPanel
              identity={isIdentityEditing ? identityDraft : petIdentity}
              isEditing={isIdentityEditing}
              isSaving={isIdentitySaving}
              errorMessage={identityErrorMessage}
              onEdit={() => {
                setIdentityDraft(petIdentity);
                setIsIdentityEditing(true);
              }}
              onCancel={() => {
                setIdentityDraft(petIdentity);
                setIsIdentityEditing(false);
                setIdentityErrorMessage('');
              }}
              onSave={savePetIdentity}
              onChange={setIdentityDraft}
            />
          )}

          {activeMenu === 'skin' && (
            <SkinPanel
              skins={petSkins}
              selectedSkinId={selectedPetSkinId}
              isImporting={isSkinImporting}
              message={skinMessage}
              onSelect={onPetSkinSelect}
              onImport={importPetSkin}
            />
          )}

          {activeMenu === 'skills' && (
            <SkillsPanel
              skills={skills}
              selectedSkillId={selectedSettingsSkillId}
              onSelect={setSelectedSettingsSkillId}
              onEnabledChange={onSkillEnabledChange}
            />
          )}

          {activeMenu === 'model-provider' && !selectedModelProvider && (
            <section className="settings-cli-overview" aria-label="模型供应商">
              <div className="settings-section-title">模型供应商</div>
              <div className="settings-cli-grid settings-model-provider-grid">
                {modelProviderUiConfigs.map((provider) => (
                  <ModelProviderCard
                    key={provider.id}
                    provider={provider}
                    config={modelProviderConfigs[provider.id]}
                    onSelect={() => {
                      const config = modelProviderConfigs[provider.id];
                      setSelectedModelProviderId(provider.id);
                      setModelProviderDraft({
                        provider: provider.id,
                        apiKey: '',
                        languageModelName: config.languageModelName || provider.defaultModel,
                        visionModelName: config.visionModelName || '',
                      });
                      setModelProviderMessage('');
                    }}
                  />
                ))}
              </div>
              {modelProviderMessage && <div className="settings-error">{modelProviderMessage}</div>}
            </section>
          )}

          {activeMenu === 'model-provider' && selectedModelProvider && (
            <ModelProviderDetail
              provider={selectedModelProvider}
              config={modelProviderConfigs[selectedModelProvider.id]}
              draft={modelProviderDraft}
              isSaving={isModelProviderSaving}
              isTesting={isModelProviderTesting}
              message={modelProviderMessage}
              onBack={() => {
                setSelectedModelProviderId(null);
                setModelProviderMessage('');
              }}
              onDraftChange={setModelProviderDraft}
              onSave={saveModelProviderConfig}
              onTest={testModelProviderConnection}
            />
          )}

          {activeMenu === 'translation' && (
            <TranslationPanel
              config={translationConfig}
              draft={translationDraft}
              isSaving={isTranslationSaving}
              message={translationMessage}
              hasAvailableModelProvider={hasAvailableTranslationModelProvider}
              hasCodexCli={status.cli.installed}
              onChange={setTranslationDraft}
              onSave={saveTranslationConfig}
            />
          )}

          {activeMenu === 'dev-companion' && (
            <DevelopmentCompanionPanel
              config={gitActivityConfig}
              status={gitActivityStatus}
              isSaving={isGitActivitySaving}
              isInstalling={isGitActivityInstalling}
              message={gitActivityMessage}
              onChange={setGitActivityConfig}
              onSave={saveGitActivityConfig}
              onInstall={installGitActivity}
              onRefresh={refreshGitActivityStatus}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
