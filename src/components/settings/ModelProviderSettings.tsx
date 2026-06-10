import {
  BrandPngLogo,
  InstallationDot,
  visionEnabledModelProviders,
  type ModelProviderUiConfig,
} from './shared';

export function ModelProviderCard({
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

export function ModelProviderDetail({
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
