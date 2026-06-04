import { useEffect, useState } from 'react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyStatus: CodexInstallationCheck = {
  cli: {
    installed: false,
    path: null,
    source: null,
  },
  diagnostics: {
    pid: 0,
    homeDir: '',
    configuredCliPath: null,
  },
};

function InstallationRow({
  title,
  description,
  installed,
  path,
  source,
}: {
  title: string;
  description: string;
  installed: boolean;
  path: string | null;
  source?: string | null;
}) {
  return (
    <div className="settings-installation-row">
      <div className="settings-installation-main">
        <span className={installed ? 'settings-status-dot settings-status-dot-installed' : 'settings-status-dot'} />
        <div>
          <div className="settings-installation-title">{title}</div>
          <div className="settings-installation-description">{description}</div>
        </div>
      </div>
      <div className="settings-installation-meta">
        <span className={installed ? 'settings-status-label settings-status-label-installed' : 'settings-status-label'}>
          {installed ? '已安装' : '未检测到'}
        </span>
        {source && <span className="settings-installation-source">来源：{source}</span>}
        <span className="settings-installation-path">{path ?? '无可用路径'}</span>
      </div>
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [status, setStatus] = useState<CodexInstallationCheck>(emptyStatus);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState('');

  async function refreshStatus() {
    setIsChecking(true);
    setErrorMessage('');

    try {
      if (!window.petDesktop) {
        setErrorMessage('Electron preload 未加载，无法调用主进程检测。请重启桌宠进程。');
        return;
      }

      const nextStatus = await window.petDesktop?.checkCodexInstallations();
      if (nextStatus) {
        setStatus(nextStatus);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    } finally {
      setLastCheckedAt(new Date().toLocaleTimeString());
      setIsChecking(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      void refreshStatus();
    }
  }, [isOpen]);

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

      <div className="settings-panel-body">
        <InstallationRow
          title="Codex CLI"
          description="检测 CODEX_CLI_PATH、PATH、Homebrew、NVM 和登录 shell 中的 codex 可执行文件。"
          installed={status.cli.installed}
          path={status.cli.path}
          source={status.cli.source}
        />

        {errorMessage && <div className="settings-error">{errorMessage}</div>}
        {lastCheckedAt && <div className="settings-check-time">上次检测：{lastCheckedAt}</div>}
        <div className="settings-diagnostics">
          <span>进程：{status.diagnostics.pid || '未知'}</span>
          {status.diagnostics.configuredCliPath && <span>CODEX_CLI_PATH：{status.diagnostics.configuredCliPath}</span>}
        </div>

        <button type="button" className="settings-refresh-button" disabled={isChecking} onClick={refreshStatus}>
          {isChecking ? '检测中' : '重新检测'}
        </button>
      </div>
    </aside>
  );
}
