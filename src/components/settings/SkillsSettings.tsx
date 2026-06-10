export function SkillsPanel({
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
                <input type="checkbox" checked={selectedSkill.enabled} onChange={(event) => onEnabledChange(selectedSkill.id, event.target.checked)} />
                <span>{selectedSkill.enabled ? '已启用' : '已禁用'}</span>
              </label>
            </div>
          )}
        </>
      )}
    </section>
  );
}
