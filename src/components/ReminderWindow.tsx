import { useEffect, useMemo, useState } from 'react';

function formatReminderTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function clampWheelValue(value: number, deltaY: number, max: number): number {
  const nextValue = value + (deltaY > 0 ? -1 : 1);
  return Math.min(max, Math.max(0, nextValue));
}

interface ReminderWindowProps {
  reminderId: string;
}

export function ReminderWindow({ reminderId }: ReminderWindowProps) {
  const [task, setTask] = useState<ReminderTask | null>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const plannedTime = useMemo(() => (task ? formatReminderTime(task.remindAt) : ''), [task]);

  useEffect(() => {
    let mounted = true;
    void window.petDesktop?.getReminder(reminderId).then((nextTask) => {
      if (mounted) {
        setTask(nextTask);
      }
    });

    return () => {
      mounted = false;
    };
  }, [reminderId]);

  async function complete() {
    if (!task || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await window.petDesktop?.completeReminder(task.id);
  }

  async function snooze() {
    if (!task || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await window.petDesktop?.snoozeReminder(task.id, hours, minutes);
  }

  async function close() {
    if (!task || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await window.petDesktop?.closeReminder(task.id);
  }

  return (
    <main className="reminder-window" aria-label="定时提醒">
      <button type="button" className="reminder-close" aria-label="关闭提醒" onClick={close}>
        ×
      </button>
      <header className="reminder-header">
        <span className="reminder-kicker">定时提醒</span>
        <h1>{task?.title || '提醒事项'}</h1>
      </header>
      <section className="reminder-body">
        <div className="reminder-row">
          <span>计划时间</span>
          <strong>{plannedTime || '读取中...'}</strong>
        </div>
        {task?.originalText && <p className="reminder-original">{task.originalText}</p>}
      </section>
      <section className="reminder-snooze" aria-label="延长提醒时间">
        <span>延长</span>
        <label>
          <input
            type="number"
            min={0}
            max={23}
            value={hours}
            disabled={isSubmitting}
            onChange={(event) => setHours(Math.min(23, Math.max(0, Number(event.target.value) || 0)))}
            onWheel={(event) => {
              event.preventDefault();
              setHours((current) => clampWheelValue(current, event.deltaY, 23));
            }}
          />
          小时
        </label>
        <label>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            disabled={isSubmitting}
            onChange={(event) => setMinutes(Math.min(59, Math.max(0, Number(event.target.value) || 0)))}
            onWheel={(event) => {
              event.preventDefault();
              setMinutes((current) => clampWheelValue(current, event.deltaY, 59));
            }}
          />
          分钟
        </label>
      </section>
      <footer className="reminder-actions">
        <button type="button" className="reminder-secondary-button" disabled={isSubmitting} onClick={snooze}>
          确定延长
        </button>
        <button type="button" className="reminder-primary-button" disabled={isSubmitting} onClick={complete}>
          知道啦
        </button>
      </footer>
    </main>
  );
}
