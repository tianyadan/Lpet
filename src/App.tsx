import { useEffect, useMemo, useRef, useState } from 'react';
import petDefinition from './assets/pets/neko-star/pet.json';
import spritesheetUrl from './assets/pets/neko-star/spritesheet.webp';
import { CodexPanel } from './components/CodexPanel';
import { PetContextMenu } from './components/PetContextMenu';
import { PetSpeechBubble } from './components/PetSpeechBubble';
import { PetScaleHandle } from './components/PetScaleHandle';
import { QuickCommandInput } from './components/QuickCommandInput';
import { SettingsPanel } from './components/SettingsPanel';
import { TaskStatusLights } from './components/TaskStatusLights';
import { PetActionRegistry } from './pet/PetActionRegistry';
import { PetRenderer } from './pet/PetRenderer';
import { usePetScale } from './hooks/usePetScale';
import type { PetActionContext, PetAnimationState, PetDefinition } from './pet/types';
import {
  applyProgressEvents,
  createIdleSteps,
  extractAssistantText,
  extractPetResponse,
  extractPlanSteps,
  extractSessionId,
  type TaskStep,
} from './utils/codexOutput';

const pet = petDefinition as PetDefinition;

function createActionRegistry(): PetActionRegistry {
  const registry = new PetActionRegistry();

  registry.register({
    id: 'codex',
    label: '打开窗口对话',
    run: ({ openCodexPanel, setState }) => {
      void openCodexPanel();
      setState('waiting');
    },
  });
  registry.register({
    id: 'settings',
    label: '设置',
    run: ({ openSettingsPanel, setState }) => {
      openSettingsPanel();
      setState('waiting');
    },
  });
  registry.register({
    id: 'idle',
    label: '待机',
    group: 'expression',
    run: ({ setState }) => setState('idle'),
  });
  registry.register({
    id: 'work',
    label: '工作中',
    group: 'expression',
    run: ({ setState }) => setState('running'),
  });
  registry.register({
    id: 'wait',
    label: '等待输入',
    group: 'expression',
    run: ({ setState }) => setState('waiting'),
  });
  registry.register({
    id: 'wave',
    label: '打招呼',
    group: 'expression',
    run: ({ setState }) => setState('waving', 1800),
  });
  registry.register({
    id: 'jump',
    label: '开心跳跃',
    group: 'expression',
    run: ({ setState }) => setState('jumping', 1800),
  });
  registry.register({
    id: 'review',
    label: '完成检查',
    group: 'expression',
    run: ({ setState }) => setState('review', 2200),
  });
  registry.register({
    id: 'failed',
    label: '受阻',
    group: 'expression',
    run: ({ setState }) => setState('failed', 2200),
  });
  registry.register({
    id: 'hide',
    label: '收起',
    run: ({ hide }) => hide(),
  });
  registry.register({
    id: 'quit',
    label: '退出',
    run: ({ quit }) => quit(),
  });

  return registry;
}

export function App() {
  const view = new URLSearchParams(window.location.search).get('view') ?? 'pet';
  const [state, setStateValue] = useState<PetAnimationState>('idle');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isQuickCommandOpen, setIsQuickCommandOpen] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickIntent, setQuickIntent] = useState<CodexRunIntent>('chat');
  const [quickSessionId, setQuickSessionId] = useState<string | null>(null);
  const [isQuickRunning, setIsQuickRunning] = useState(false);
  const [bubbleText, setBubbleText] = useState('');
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>(createIdleSteps);
  const rawQuickOutputRef = useRef('');
  const resetVisualTimerRef = useRef<number | null>(null);
  const registry = useMemo(createActionRegistry, []);
  const actions = useMemo(() => registry.list(), [registry]);
  const {
    showScaleHandle,
    handleScalePointerDown,
    petStageStyle,
    setIsHovered: setIsPetHovered,
    isScaling,
  } = usePetScale();

  const context = useMemo<PetActionContext>(
    () => ({
      setState: (nextState, durationMs) => {
        setStateValue(nextState);
        if (durationMs) {
          window.setTimeout(() => setStateValue('idle'), durationMs);
        }
      },
      openCodexPanel: async () => {
        await window.petDesktop?.openCodexPanel();
      },
      openSettingsPanel: () => {
        setIsSettingsPanelOpen(true);
      },
      hide: async () => {
        await window.petDesktop?.hide();
      },
      quit: async () => {
        await window.petDesktop?.quit();
      },
    }),
    [],
  );

  function scheduleTaskVisualReset(delayMs = 18000) {
    if (resetVisualTimerRef.current !== null) {
      window.clearTimeout(resetVisualTimerRef.current);
    }

    resetVisualTimerRef.current = window.setTimeout(() => {
      finishQuickVisualState();
      resetVisualTimerRef.current = null;
    }, delayMs);
  }

  function finishQuickVisualState() {
    if (resetVisualTimerRef.current !== null) {
      window.clearTimeout(resetVisualTimerRef.current);
      resetVisualTimerRef.current = null;
    }

    setStateValue('idle');
    setIsBubbleVisible(false);
    setTaskSteps(createIdleSteps());
  }

  /** 用户主动关闭气泡：结束当前 Codex 会话上下文，下次从全新对话开始。 */
  function closeQuickConversation() {
    finishQuickVisualState();
    setQuickSessionId(null);
    rawQuickOutputRef.current = '';
    setQuickPrompt('');
  }

  /** 在已有回复基础上继续追问，保留 sessionId 以便 CLI resume。 */
  function handleBubbleReply() {
    if (isQuickRunning) {
      return;
    }

    setIsQuickCommandOpen(true);
    setMenuPosition(null);
  }

  useEffect(() => {
    const unsubscribe = window.petDesktop?.onCodexEvent((event) => {
      if (event.type === 'start') {
        rawQuickOutputRef.current = '';
        setIsQuickRunning(true);
        setIsBubbleVisible(true);
        setBubbleText(event.intent === 'task' ? '执行任务中' : 'thinking...');
        setTaskSteps(createIdleSteps());
        setStateValue('running');
        return;
      }

      if (event.type === 'stdout' || event.type === 'stderr') {
        rawQuickOutputRef.current += event.text;

        const nextSessionId = extractSessionId(rawQuickOutputRef.current);
        if (nextSessionId) {
          setQuickSessionId(nextSessionId);
        }

        const nextPlan = extractPlanSteps(rawQuickOutputRef.current);
        if (nextPlan.length > 0) {
          setTaskSteps(applyProgressEvents(nextPlan, rawQuickOutputRef.current));
        } else {
          setTaskSteps((current) => applyProgressEvents(current, rawQuickOutputRef.current));
        }

        const petResponse = extractPetResponse(rawQuickOutputRef.current);
        if (petResponse) {
          setBubbleText(petResponse.answer || (petResponse.mode === 'task' ? '执行任务中' : ''));
          if (petResponse.mode === 'chat') {
            setTaskSteps(createIdleSteps());
          }
          return;
        }

        if (nextPlan.length > 0) {
          setBubbleText('执行任务中');
          return;
        }

        const assistantText = extractAssistantText(rawQuickOutputRef.current);
        if (assistantText) {
          setBubbleText(assistantText);
        }
        return;
      }

      if (event.type === 'error') {
        setIsQuickRunning(false);
        setStateValue('failed');
        setBubbleText(`[error] ${event.message}`);
        setTaskSteps((current) =>
          current.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)),
        );
        scheduleTaskVisualReset();
        return;
      }

      if (event.type === 'cancelled') {
        setIsQuickRunning(false);
        setStateValue('failed');
        setBubbleText('任务已停止。');
        scheduleTaskVisualReset();
        return;
      }

      if (event.type === 'exit') {
        setIsQuickRunning(false);
        setStateValue(event.code === 0 ? 'review' : 'failed');
        const assistantText = extractAssistantText(rawQuickOutputRef.current);
        setBubbleText((current) => assistantText || (current === 'thinking...' ? '这次没有拿到有效回复，请重试一次。' : current));
        setTaskSteps((current) =>
          current.map((step) =>
            step.status === 'idle'
              ? step
              : {
                  ...step,
                  status: event.code === 0 ? 'done' : step.status === 'running' ? 'failed' : step.status,
                },
          ),
        );
        scheduleTaskVisualReset(assistantText ? 30000 : 18000);
      }
    });

    return () => {
      unsubscribe?.();
      if (resetVisualTimerRef.current !== null) {
        window.clearTimeout(resetVisualTimerRef.current);
      }
    };
  }, []);

  async function submitQuickCommand() {
    const normalizedPrompt = quickPrompt.trim();
    if (!normalizedPrompt || isQuickRunning) {
      return;
    }

    setIsQuickCommandOpen(false);
    setQuickPrompt('');
    setIsBubbleVisible(true);
    setBubbleText(quickIntent === 'task' ? '执行任务中' : 'thinking...');
    setTaskSteps(createIdleSteps());
    setStateValue('running');

    try {
      await window.petDesktop?.runCodex(normalizedPrompt, 'codex-cli', quickSessionId, quickIntent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIsQuickRunning(false);
      setStateValue('failed');
      setBubbleText(`[error] ${message}`);
      scheduleTaskVisualReset();
    }
  }

  async function interruptQuickCommand() {
    if (!isQuickRunning) {
      return;
    }

    await window.petDesktop?.cancelCodex();
    setIsQuickRunning(false);
    setStateValue('failed');
    setBubbleText('任务已中断。');
    setTaskSteps((current) =>
      current.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)),
    );
    scheduleTaskVisualReset();
  }

  if (view === 'codex') {
    return (
      <main className="codex-window-stage">
        <CodexPanel
          isOpen
          detached
          onClose={() => {
            void window.petDesktop?.closeCodexPanel();
          }}
          onRunningChange={() => undefined}
        />
      </main>
    );
  }

  return (
    <main
      className="pet-stage"
      style={petStageStyle}
      onClick={() => setMenuPosition(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuPosition({ x: event.clientX, y: event.clientY });
      }}
    >
      <section
        className="pet-shell"
        aria-label={`${pet.displayName} desktop pet`}
        onMouseEnter={() => setIsPetHovered(true)}
        onMouseLeave={() => {
          if (!isScaling) {
            setIsPetHovered(false);
          }
        }}
      >
        <button
          type="button"
          className="pet-double-click-target"
          aria-label="打开快捷 AI 输入"
          onDoubleClick={(event) => {
            event.stopPropagation();
            setIsQuickCommandOpen(true);
            setMenuPosition(null);
          }}
        >
          <PetRenderer spritesheetUrl={spritesheetUrl} state={state} />
        </button>
        {showScaleHandle && <PetScaleHandle onPointerDown={handleScalePointerDown} />}
      </section>

      <TaskStatusLights steps={taskSteps} />
      <PetSpeechBubble
        text={bubbleText}
        isVisible={isBubbleVisible}
        isRunning={isQuickRunning}
        onClose={closeQuickConversation}
        onInterrupt={interruptQuickCommand}
        onReply={handleBubbleReply}
      />

      {isQuickCommandOpen && (
        <QuickCommandInput
          prompt={quickPrompt}
          intent={quickIntent}
          isRunning={isQuickRunning}
          hasSession={Boolean(quickSessionId)}
          onPromptChange={setQuickPrompt}
          onIntentChange={setQuickIntent}
          onSubmit={submitQuickCommand}
          onClose={() => setIsQuickCommandOpen(false)}
        />
      )}

      {menuPosition && (
        <PetContextMenu
          actions={actions}
          context={context}
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
        />
      )}

      <SettingsPanel isOpen={isSettingsPanelOpen} onClose={() => setIsSettingsPanelOpen(false)} />
    </main>
  );
}
