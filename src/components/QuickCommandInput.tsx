interface QuickCommandInputProps {
  prompt: string;
  intent: CodexRunIntent;
  isRunning: boolean;
  onPromptChange: (prompt: string) => void;
  onIntentChange: (intent: CodexRunIntent) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function QuickCommandInput({
  prompt,
  intent,
  isRunning,
  onPromptChange,
  onIntentChange,
  onSubmit,
  onClose,
}: QuickCommandInputProps) {
  return (
    <section className="quick-command" aria-label="快捷 AI 指令">
      <div className="quick-command-row">
        <select className="quick-command-provider" disabled={isRunning} value="codex-cli" aria-label="选择 CLI">
          <option value="codex-cli">Codex CLI</option>
        </select>
        <button type="button" className="quick-command-close" onClick={onClose} aria-label="关闭快捷输入">
          ×
        </button>
      </div>
      <textarea
        className="quick-command-input"
        value={prompt}
        disabled={isRunning}
        autoFocus
        placeholder="输入快捷任务..."
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="quick-command-footer">
        <div className="quick-command-intent" role="radiogroup" aria-label="选择交互类型">
          <button
            type="button"
            className={intent === 'chat' ? 'quick-command-intent-active' : ''}
            disabled={isRunning}
            onClick={() => onIntentChange('chat')}
          >
            问答
          </button>
          <button
            type="button"
            className={intent === 'task' ? 'quick-command-intent-active' : ''}
            disabled={isRunning}
            onClick={() => onIntentChange('task')}
          >
            执行任务
          </button>
        </div>
        <button type="button" className="quick-command-submit" disabled={isRunning || !prompt.trim()} onClick={onSubmit}>
          发送
        </button>
      </div>
    </section>
  );
}
