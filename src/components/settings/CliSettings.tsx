import { InstallationDot, type CliProviderConfig } from './shared';

export function CliProviderCard({
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

export function CliProviderDetail({
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
        <span>
          {provider.envName}：{configuredPath ?? '未配置'}
        </span>
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
