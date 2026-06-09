import { useMemo, useState } from 'react';

function formatReminderDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

interface ReminderTaskPanelProps {
  tasks: ReminderTask[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function ReminderTaskPanel({ tasks, onClose, onRefresh }: ReminderTaskPanelProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftRemindAt, setDraftRemindAt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const sortedTasks = useMemo(
    () => [...tasks].sort((left, right) => new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime()),
    [tasks],
  );

  function startEdit(task: ReminderTask) {
    setEditingTaskId(task.id);
    setDraftTitle(task.title);
    setDraftRemindAt(toDateTimeLocalValue(task.remindAt));
    setErrorMessage('');
  }

  async function saveEdit(task: ReminderTask) {
    const nextTitle = draftTitle.trim();
    const nextDate = new Date(draftRemindAt);
    if (!nextTitle || !draftRemindAt || Number.isNaN(nextDate.getTime())) {
      setErrorMessage('请填写有效的标题和提醒时间。');
      return;
    }

    await window.petDesktop?.updateReminder({
      id: task.id,
      title: nextTitle,
      remindAt: nextDate.toISOString(),
      originalText: task.originalText,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setEditingTaskId(null);
    setErrorMessage('');
    await onRefresh();
  }

  async function cancelTask(task: ReminderTask) {
    const confirmed = window.confirm(`确定删除提醒「${task.title}」吗？`);
    if (!confirmed) {
      return;
    }

    await window.petDesktop?.cancelReminder(task.id);
    await onRefresh();
  }

  return (
    <aside className="reminder-task-panel" aria-label="定时任务列表">
      <header className="reminder-task-panel-header">
        <span>定时任务</span>
        <button type="button" aria-label="关闭定时任务列表" onClick={onClose}>
          ×
        </button>
      </header>

      {errorMessage && <div className="reminder-task-error">{errorMessage}</div>}

      <div className="reminder-task-list">
        {sortedTasks.length === 0 ? (
          <div className="reminder-task-empty">暂无规划中的定时任务。</div>
        ) : (
          sortedTasks.map((task) => {
            const isEditing = editingTaskId === task.id;
            return (
              <article key={task.id} className="reminder-task-card">
                {isEditing ? (
                  <div className="reminder-task-edit">
                    <input
                      value={draftTitle}
                      maxLength={80}
                      onChange={(event) => setDraftTitle(event.target.value)}
                    />
                    <input
                      type="datetime-local"
                      value={draftRemindAt}
                      onChange={(event) => setDraftRemindAt(event.target.value)}
                    />
                    <div className="reminder-task-actions">
                      <button type="button" onClick={() => void saveEdit(task)}>
                        保存
                      </button>
                      <button type="button" onClick={() => setEditingTaskId(null)}>
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="reminder-task-main">
                      <strong>{task.title}</strong>
                      <span>{formatReminderDateTime(task.remindAt)}</span>
                      {task.status === 'fired' && <em>已到期，等待处理</em>}
                    </div>
                    <div className="reminder-task-actions">
                      <button type="button" onClick={() => startEdit(task)}>
                        编辑
                      </button>
                      <button type="button" className="reminder-task-danger" onClick={() => void cancelTask(task)}>
                        删除
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
