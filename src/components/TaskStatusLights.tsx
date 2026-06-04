import type { TaskStep } from '../utils/codexOutput';

interface TaskStatusLightsProps {
  steps: TaskStep[];
}

export function TaskStatusLights({ steps }: TaskStatusLightsProps) {
  return (
    <aside className="task-status-lights" aria-label="任务状态灯">
      {steps.slice(0, 6).map((step) => (
        <span
          key={step.id}
          className={`task-status-light task-status-light-${step.status}`}
          title={step.label}
          aria-label={`${step.label}: ${step.status}`}
        />
      ))}
    </aside>
  );
}
