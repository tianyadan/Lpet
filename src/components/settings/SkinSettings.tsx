export function SkinPanel({
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

      {message && <div className={message.includes('成功') || message.includes('已导入') ? 'settings-success' : 'settings-error'}>{message}</div>}

      <div className="settings-section-actions">
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isImporting} onClick={onImport}>
          {isImporting ? '导入中' : '导入皮肤'}
        </button>
      </div>
    </section>
  );
}
