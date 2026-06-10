import { translationLanguageOptions } from './shared';

export function TranslationPanel({
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

      {message && <div className={message.includes('保存') ? 'settings-success' : 'settings-error'}>{message}</div>}

      <div className="settings-section-actions">
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isSaving} onClick={onSave}>
          {isSaving ? '保存中' : '保存翻译配置'}
        </button>
      </div>
    </section>
  );
}
