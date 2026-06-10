import { useEffect, useMemo, useState } from 'react';
import { CliProviderCard, CliProviderDetail } from './settings/CliSettings';
import { DevelopmentCompanionPanel } from './settings/DevelopmentCompanionSettings';
import { ModelProviderCard, ModelProviderDetail } from './settings/ModelProviderSettings';
import { PetIdentityPanel } from './settings/PetIdentitySettings';
import { SkillsPanel } from './settings/SkillsSettings';
import { SkinPanel } from './settings/SkinSettings';
import { TranslationPanel } from './settings/TranslationSettings';
import {
  cliProviders,
  createEmptyModelProviderConfigs,
  emptyGitActivityConfig,
  emptyGitActivityStatus,
  emptyPetIdentity,
  emptyStatus,
  emptyTranslationConfig,
  getConfiguredPath,
  modelProviderUiConfigs,
  normalizeGitActivityStatus,
  sanitizeIdentityDraft,
  type CliProviderId,
  type SettingsMenuKey,
} from './settings/shared';

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
