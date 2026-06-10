export function DevelopmentCompanionPanel({
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
          <p>记录本地 commit 与 push 记录，用心陪伴开发者每一天</p>
        </div>
      </div>

      <div className="settings-installation-meta settings-installation-meta-detail">
        <span className={ready ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>{ready ? '已接入' : '未接入'}</span>
        <span className="settings-installation-source">
          点击“一键安装并写入”会创建 {status.wrapperPath || '~/.lpet/bin/git'}，并向常用 shell 配置写入 PATH。
        </span>
      </div>

      <div className="settings-form-grid settings-model-form-grid">
        <label className="settings-toggle-row settings-toggle-row-block">
          <input type="checkbox" checked={config.enabled} onChange={(event) => onChange({ ...config, enabled: event.target.checked })} />
          <span>启用 Git 全局统计</span>
        </label>
        <label className="settings-toggle-row settings-toggle-row-block">
          <input type="checkbox" checked={config.translateCommit} onChange={(event) => onChange({ ...config, translateCommit: event.target.checked })} />
          <span>Commit 信息转中文（后续接入模型后会消耗 Token）</span>
        </label>
        <label className="settings-field">
          <span>每日总结时间</span>
          <input type="time" value={config.summaryTime} onChange={(event) => onChange({ ...config, summaryTime: event.target.value || '20:00' })} />
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

      {/* <div className="settings-diagnostics settings-dev-diagnostics">
        <span>Wrapper：{status.wrapperInstalled ? '已安装' : '未安装'} · {status.wrapperPath || '未知'}</span>
        <span>Shell PATH：{hasShellProfileConfigured ? '已写入 shell profile' : '未写入 shell profile'}</span>
        <span>.zshrc：{status.zshrcConfigured ? '已写入' : '未写入'} · .zprofile：{status.zprofileConfigured ? '已写入' : '未写入'}</span>
        <span>.bashrc：{status.bashrcConfigured ? '已写入' : '未写入'} · .bash_profile：{status.bashProfileConfigured ? '已写入' : '未写入'}</span>
        <span>当前进程 PATH：{status.currentShellConfigured ? '已包含 ~/.lpet/bin' : '未包含 ~/.lpet/bin'}</span>
        <span>真实 Git：{status.realGitPath ?? '未检测到'}</span>
        <span>Node：{status.nodePath ?? '未检测到'}</span>
        <span>SQLite：{status.databasePath || '未知'}</span>
      </div> */}

      {/* {status.recentEvents.length > 0 && (
        <div className="settings-dev-events">
          {status.recentEvents.slice(0, 4).map((event) => (
            <div key={event.id}>
              <span>{event.eventType}</span>
              <strong>{event.commitMessage || event.remote || '已记录'}</strong>
            </div>
          ))}
        </div>
      )}

      {message && <div className={message.includes('成功') || message.includes('保存') ? 'settings-success' : 'settings-error'}>{message}</div>} */}

      <div className="settings-section-actions settings-model-actions">
        <button type="button" className="settings-secondary-button" disabled={isInstalling} onClick={onRefresh}>
          刷新
        </button>
        <button type="button" className="settings-secondary-button" disabled={isSaving} onClick={onSave}>
          {isSaving ? '保存中' : '保存'}
        </button>
        <button type="button" className="settings-refresh-button settings-save-button" disabled={isInstalling} onClick={onInstall}>
          {isInstalling ? '安装中' : '安装'}
        </button>
      </div>
    </section>
  );
}
