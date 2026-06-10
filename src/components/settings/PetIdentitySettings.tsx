type PetGender = PetIdentity['gender'];

export function PetIdentityPanel({
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
          <input value={identity.name} disabled={!isEditing} maxLength={40} onChange={(event) => updateField('name', event.target.value)} />
        </label>
        <label className="settings-field">
          <span>主人</span>
          <input value={identity.owner} disabled={!isEditing} maxLength={40} onChange={(event) => updateField('owner', event.target.value)} />
        </label>
        <label className="settings-field">
          <span>年龄</span>
          <input value={identity.age} disabled={!isEditing} maxLength={20} onChange={(event) => updateField('age', event.target.value)} />
        </label>
        <label className="settings-field">
          <span>爱好</span>
          <input value={identity.hobbies} disabled={!isEditing} maxLength={160} onChange={(event) => updateField('hobbies', event.target.value)} />
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
