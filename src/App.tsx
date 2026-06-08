import { useEffect, useMemo, useRef, useState } from 'react';
import deepseekLogoUrl from './assets/model-providers/deepseek-logo.png';
import qwenLogoUrl from './assets/model-providers/qwen-logo.png';
import petDefinition from './assets/pets/neko-star/pet.json';
import spritesheetUrl from './assets/pets/neko-star/spritesheet.webp';
import { CodexPanel } from './components/CodexPanel';
import { PetContextMenu } from './components/PetContextMenu';
import { PetSpeechBubble } from './components/PetSpeechBubble';
import { PetScaleHandle } from './components/PetScaleHandle';
import { QuickCommandInput, type QuickCommandTargetOption } from './components/QuickCommandInput';
import { ReminderWindow } from './components/ReminderWindow';
import { SentImagePreview } from './components/SentImagePreview';
import { SettingsPanel } from './components/SettingsPanel';
import { TaskStatusLights } from './components/TaskStatusLights';
import { PetActionRegistry } from './pet/PetActionRegistry';
import { PetRenderer } from './pet/PetRenderer';
import { usePetScale } from './hooks/usePetScale';
import { usePetDrag } from './hooks/usePetDrag';
import { usePetWindowLayout, applyPetWindowLayout } from './hooks/usePetWindowLayout';
import { usePetMousePassthrough } from './hooks/usePetMousePassthrough';
import type { PetActionContext, PetAnimationState, PetDefinition } from './pet/types';
import type { PetWindowLayoutState } from './pet/constants';
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
const defaultCliStatus: CliInstallationStatus = { installed: false, path: null, source: null };
const defaultInstallations: CodexInstallationCheck = {
  cli: defaultCliStatus,
  cursor: defaultCliStatus,
  claudeCode: defaultCliStatus,
  diagnostics: {
    pid: 0,
    homeDir: '',
    configuredCliPath: null,
    configuredCursorPath: null,
    configuredClaudePath: null,
  },
};
const providerLogos: Record<ModelProviderId, string> = {
  qwen: qwenLogoUrl,
  deepseek: deepseekLogoUrl,
};
const providerLabels: Record<ModelProviderId, string> = {
  qwen: '通义千问',
  deepseek: 'DeepSeek',
};
const sandboxPermissionFailurePattern =
  /(Operation not permitted|Permission denied|权限不足|权限被拒绝|沙箱|sandbox|not permitted|EPERM|EACCES)/i;

interface QuickCliRunRequest {
  prompt: string;
  target: CodexRunTarget;
  sessionId: string | null;
  intent: CodexRunIntent;
  elevated: boolean;
}

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
    run: ({ openSettingsPanel }) => {
      openSettingsPanel();
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
  const [quickAttachedImage, setQuickAttachedImage] = useState<string | null>(null);
  const [sentImagePreview, setSentImagePreview] = useState<string | null>(null);
  const [quickIntent, setQuickIntent] = useState<CodexRunIntent>('chat');
  const [quickTargetId, setQuickTargetId] = useState('codex-cli');
  const [localSkills, setLocalSkills] = useState<LocalSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<LocalSkill | null>(null);
  const [isQuickSkillMenuOpen, setIsQuickSkillMenuOpen] = useState(false);
  const [installations, setInstallations] = useState<CodexInstallationCheck>(defaultInstallations);
  const [modelProviderConfigs, setModelProviderConfigs] = useState<PublicModelProviderConfig[]>([]);
  const [quickSessionId, setQuickSessionId] = useState<string | null>(null);
  const [isQuickRunning, setIsQuickRunning] = useState(false);
  const [bubbleText, setBubbleText] = useState('');
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>(createIdleSteps);
  const rawQuickOutputRef = useRef('');
  const lastQuickCliRunRef = useRef<QuickCliRunRequest | null>(null);
  const resetVisualTimerRef = useRef<number | null>(null);
  const preDragStateRef = useRef<PetAnimationState>('idle');
  const petAnimationRef = useRef<PetAnimationState>('idle');
  const isQuickRunningRef = useRef(false);
  const [isPetDragging, setIsPetDragging] = useState(false);
  const [isExpressionMenuOpen, setIsExpressionMenuOpen] = useState(false);
  const registry = useMemo(createActionRegistry, []);
  const actions = useMemo(() => registry.list(), [registry]);
  const quickTargetOptions = useMemo<QuickCommandTargetOption[]>(() => {
    const cliOptions: QuickCommandTargetOption[] = installations.cli.installed
      ? [{ id: 'codex-cli', label: 'Codex CLI', kind: 'cli' }]
      : [];

    if (quickIntent === 'task') {
      return cliOptions;
    }

    const providerOptions = modelProviderConfigs
      .filter((config) => config.languageTestStatus === 'success' && config.hasApiKey && config.languageModelName)
      .map<QuickCommandTargetOption>((config) => ({
        id: `model:${config.provider}`,
        label: providerLabels[config.provider],
        logoUrl: providerLogos[config.provider],
        kind: 'provider',
      }));

    // WHY：问答和快捷翻译优先走用户配置的模型供应商，CLI 只作为没有供应商时的兜底入口。
    return [...providerOptions, ...cliOptions];
  }, [installations.cli.installed, modelProviderConfigs, quickIntent]);
  const canAttachImage = useMemo(
    () => modelProviderConfigs.some((config) => config.provider === 'qwen' && config.visionTestStatus === 'success' && config.visionModelName),
    [modelProviderConfigs],
  );
  const {
    showScaleHandle,
    handleScalePointerDown,
    petStageStyle,
    setIsHovered: setIsPetHovered,
    isHovered: isPetHovered,
    isScaling,
    scale: petScale,
  } = usePetScale();

  // WHY：悬停跳跃是展示层优先级，不能覆盖拖拽方向、AI 任务和缩放把手操作。
  const petDisplayState: PetAnimationState =
    isPetDragging || isQuickRunning || isScaling ? state : isPetHovered ? 'jumping' : state;

  /** 统一窗口布局参数，避免多处漏传图片预览状态。 */
  function buildPetWindowLayout(overrides: Partial<PetWindowLayoutState> = {}): PetWindowLayoutState {
    return {
      scale: petScale,
      isBubbleVisible,
      isQuickCommandOpen,
      isSettingsPanelOpen,
      hasContextMenu: Boolean(menuPosition),
      isExpressionMenuOpen,
      hasQuickCommandImage: Boolean(quickAttachedImage),
      hasQuickCommandSkillMenu: isQuickSkillMenuOpen,
      hasSentImagePreview: Boolean(sentImagePreview),
      ...overrides,
    };
  }

  usePetWindowLayout(buildPetWindowLayout());

  usePetMousePassthrough(view === 'pet', isPetDragging || isScaling);

  petAnimationRef.current = state;
  isQuickRunningRef.current = isQuickRunning;

  async function refreshQuickTargets() {
    if (!window.petDesktop) {
      return;
    }

    const [nextInstallations, nextModelConfigs, nextLocalSkills] = await Promise.all([
      window.petDesktop.checkCodexInstallations(),
      window.petDesktop.listModelProviderConfigs(),
      window.petDesktop.listLocalSkills(),
    ]);
    setInstallations(nextInstallations);
    setModelProviderConfigs(nextModelConfigs);
    setLocalSkills(nextLocalSkills);
  }

  useEffect(() => {
    const currentTarget = quickTargetOptions.find((option) => option.id === quickTargetId);
    const preferredProviderTarget = quickTargetOptions.find((option) => option.kind === 'provider');
    if (quickIntent === 'chat' && preferredProviderTarget && currentTarget?.kind !== 'provider') {
      setQuickTargetId(preferredProviderTarget.id);
      return;
    }

    if (!currentTarget) {
      setQuickTargetId(quickTargetOptions[0]?.id ?? 'codex-cli');
    }
  }, [quickIntent, quickTargetId, quickTargetOptions]);

  const { handlePetPointerDown, didDragRef } = usePetDrag({
    disabled: isScaling,
    petScale,
    onDragStart: () => {
      preDragStateRef.current = petAnimationRef.current;
      setIsPetDragging(true);
      setMenuPosition(null);
    },
    onDirectionChange: (direction) => {
      if (direction === 'left') {
        setStateValue('running-left');
      } else if (direction === 'right') {
        setStateValue('running-right');
      }
    },
    onDragEnd: () => {
      setIsPetDragging(false);

      if (isQuickRunningRef.current) {
        setStateValue('running');
        return;
      }

      const restoreState = preDragStateRef.current;
      if (restoreState === 'running-left' || restoreState === 'running-right') {
        setStateValue('idle');
        return;
      }

      setStateValue(restoreState);
    },
  });

  /** 在展示快捷输入前先扩窗口，避免首帧左缘被裁切。 */
  async function openQuickCommandPanel() {
    clearTaskVisualReset();
    void refreshQuickTargets();
    await applyPetWindowLayout(
      buildPetWindowLayout({
        isQuickCommandOpen: true,
      }),
    );
    setIsQuickCommandOpen(true);
    setMenuPosition(null);
  }

  /** 在展示设置面板前先扩窗口，避免首帧裁切。 */
  async function openSettingsPanelWithLayout() {
    await applyPetWindowLayout(
      buildPetWindowLayout({
        isSettingsPanelOpen: true,
      }),
    );
    setIsSettingsPanelOpen(true);
  }

  const context: PetActionContext = {
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
        void openSettingsPanelWithLayout();
      },
      hide: async () => {
        await window.petDesktop?.hide();
      },
      quit: async () => {
        await window.petDesktop?.quit();
      },
    };

  function clearTaskVisualReset() {
    if (resetVisualTimerRef.current !== null) {
      window.clearTimeout(resetVisualTimerRef.current);
      resetVisualTimerRef.current = null;
    }
  }

  function scheduleTaskVisualReset(delayMs = 18000) {
    clearTaskVisualReset();
    resetVisualTimerRef.current = window.setTimeout(() => {
      finishQuickVisualState();
      resetVisualTimerRef.current = null;
    }, delayMs);
  }

  function finishQuickVisualState() {
    clearTaskVisualReset();

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
    setQuickAttachedImage(null);
    setSelectedSkill(null);
    setIsQuickSkillMenuOpen(false);
    setSentImagePreview(null);
  }

  function buildSkillTaskPrompt(prompt: string, skill: LocalSkill | null): string {
    if (!skill) {
      return prompt;
    }

    return [
      '你正在执行一个桌宠任务。',
      '',
      '用户在桌宠快捷输入中明确选择了下面这个 Skill。请优先阅读并遵循该 Skill 的说明，再执行用户任务。',
      '',
      '<SelectedSkill>',
      `名称：${skill.name}`,
      `路径：${skill.entryPath}`,
      skill.description ? `描述：${skill.description}` : '',
      `来源：${skill.source}`,
      '</SelectedSkill>',
      '',
      '<UserTask>',
      prompt,
      '</UserTask>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  function isSandboxPermissionFailure(output: string): boolean {
    return sandboxPermissionFailurePattern.test(output);
  }

  async function requestElevatedRetryForLastTask() {
    const lastRun = lastQuickCliRunRef.current;
    if (!lastRun || lastRun.elevated || lastRun.intent !== 'task') {
      return false;
    }

    const allowed = window.confirm(
      '本次任务遇到沙箱或系统权限限制，导致执行失败。\n\n是否仅为本次任务授予更高执行权限并自动重试？\n\n允许后 Codex CLI 将以无沙箱模式重跑本次任务，请确认你信任这次操作。',
    );

    if (!allowed) {
      setBubbleText('已拒绝本次提权，任务保持失败状态。');
      scheduleTaskVisualReset();
      return true;
    }

    clearTaskVisualReset();
    rawQuickOutputRef.current = '';
    setIsQuickRunning(true);
    setStateValue('running');
    setIsBubbleVisible(true);
    setBubbleText('已授权本次提权，正在重试任务...');
    setTaskSteps(createIdleSteps());

    const elevatedRun: QuickCliRunRequest = {
      ...lastRun,
      elevated: true,
    };
    lastQuickCliRunRef.current = elevatedRun;

    try {
      await window.petDesktop?.runCodex(
        elevatedRun.prompt,
        elevatedRun.target,
        elevatedRun.sessionId,
        elevatedRun.intent,
        true,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIsQuickRunning(false);
      setStateValue('failed');
      setBubbleText(`[error] ${message}`);
      scheduleTaskVisualReset();
    }

    return true;
  }

  /** 在已有回复基础上继续追问，保留 sessionId 以便 CLI resume。 */
  function handleBubbleReply() {
    if (isQuickRunning) {
      return;
    }

    clearTaskVisualReset();
    void openQuickCommandPanel();
  }

  useEffect(() => {
    const unsubscribe = window.petDesktop?.onCodexEvent((event) => {
      if (event.type === 'start') {
        clearTaskVisualReset();
        rawQuickOutputRef.current = '';
        setIsQuickRunning(true);
        setIsBubbleVisible(true);
        setBubbleText(event.elevated ? '已授权本次提权，执行任务中' : event.intent === 'task' ? '执行任务中' : 'thinking...');
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

      if (event.type === 'translation-start') {
        clearTaskVisualReset();
        setIsQuickRunning(true);
        setIsBubbleVisible(true);
        setStateValue('running');
        setTaskSteps(createIdleSteps());
        setBubbleText(`正在翻译为${event.targetLanguage}...`);
        return;
      }

      if (event.type === 'translation-result') {
        setIsQuickRunning(false);
        setIsBubbleVisible(true);
        setStateValue('review');
        setTaskSteps(createIdleSteps());
        setBubbleText(event.text);
        scheduleTaskVisualReset(30000);
        return;
      }

      if (event.type === 'translation-error') {
        setIsQuickRunning(false);
        setIsBubbleVisible(true);
        setStateValue('failed');
        setTaskSteps(createIdleSteps());
        setBubbleText(event.message);
        scheduleTaskVisualReset();
        return;
      }

      if (event.type === 'reminder-created') {
        const remindAt = new Date(event.remindAt);
        const formattedTime = Number.isNaN(remindAt.getTime())
          ? event.remindAt
          : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(remindAt);
        setBubbleText(`定时提醒已创建完成，我会在 ${formattedTime} 提醒你：${event.title}`);
        setTaskSteps(createIdleSteps());
        return;
      }

      if (event.type === 'exit') {
        setIsQuickRunning(false);
        if (
          event.code !== 0 &&
          isSandboxPermissionFailure(rawQuickOutputRef.current) &&
          lastQuickCliRunRef.current?.intent === 'task' &&
          !lastQuickCliRunRef.current.elevated
        ) {
          setStateValue('waiting');
          setBubbleText('检测到权限限制，等待你确认是否本次提权重试。');
          void requestElevatedRetryForLastTask();
          return;
        }

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
    if ((!normalizedPrompt && !quickAttachedImage) || isQuickRunning) {
      return;
    }

    clearTaskVisualReset();
    const outgoingImage = quickAttachedImage;
    const outgoingSkill = quickIntent === 'task' ? selectedSkill : null;
    const selectedTargetId = quickTargetOptions.some((option) => option.id === quickTargetId)
      ? quickTargetId
      : quickTargetOptions[0]?.id ?? 'codex-cli';

    setIsQuickCommandOpen(false);
    setQuickPrompt('');
    setQuickAttachedImage(null);
    setSelectedSkill(null);
    setIsQuickSkillMenuOpen(false);
    setSentImagePreview(null);
    setIsBubbleVisible(true);
    setBubbleText(quickIntent === 'task' ? '执行任务中' : 'thinking...');
    setTaskSteps(createIdleSteps());
    setStateValue('running');
    setIsQuickRunning(true);

    try {
      if (quickIntent === 'chat' && selectedTargetId.startsWith('model:')) {
        const provider = selectedTargetId.replace('model:', '') as ModelProviderId;
        const response = await window.petDesktop?.chatWithModelProvider({
          provider,
          prompt: normalizedPrompt || '请根据图片回答。',
          imageDataUrl: outgoingImage,
        });
        setBubbleText(response?.answer || '这次没有拿到有效回复，请重试一次。');
        setIsQuickRunning(false);
        setStateValue('review');
        scheduleTaskVisualReset(30000);
        return;
      }

      let promptForCli = buildSkillTaskPrompt(normalizedPrompt, outgoingSkill);
      if (outgoingImage) {
        const imageText = await window.petDesktop?.analyzeImageWithVisionModel({
          prompt: normalizedPrompt || '请描述这张图片。',
          imageDataUrl: outgoingImage,
        });
        const userPromptWithImage = [
          '用户上传了一张图片。下面是多模态模型对图片的解析结果，请结合用户问题回答。',
          imageText ? `图片解析：${imageText}` : '',
          `用户问题：${normalizedPrompt || '请描述这张图片。'}`,
        ]
          .filter(Boolean)
          .join('\n\n');
        promptForCli = [
          outgoingSkill
            ? buildSkillTaskPrompt(userPromptWithImage, outgoingSkill)
            : userPromptWithImage,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      const cliRunRequest: QuickCliRunRequest = {
        prompt: promptForCli,
        target: 'codex-cli',
        sessionId: quickSessionId,
        intent: quickIntent,
        elevated: false,
      };
      lastQuickCliRunRef.current = cliRunRequest;
      await window.petDesktop?.runCodex(
        cliRunRequest.prompt,
        cliRunRequest.target,
        cliRunRequest.sessionId,
        cliRunRequest.intent,
        cliRunRequest.elevated,
      );
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

  if (view === 'reminder') {
    const reminderId = new URLSearchParams(window.location.search).get('reminderId') ?? '';
    return <ReminderWindow reminderId={reminderId} />;
  }

  return (
    <main
      className={`pet-stage${isQuickCommandOpen ? ' pet-stage-quick-open' : ''}`}
      style={petStageStyle}
      onClick={() => setMenuPosition(null)}
    >
      <section
        className={`pet-shell${isPetDragging ? ' pet-shell-dragging' : ''}`}
        aria-label={`${pet.displayName} desktop pet`}
        onMouseEnter={() => setIsPetHovered(true)}
        onMouseLeave={() => {
          if (!isScaling && !isPetDragging) {
            setIsPetHovered(false);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void applyPetWindowLayout(
            buildPetWindowLayout({
              hasContextMenu: true,
            }),
          ).then(() => {
            setMenuPosition({ x: event.clientX, y: event.clientY });
          });
        }}
      >
        <button
          type="button"
          className="pet-double-click-target"
          aria-label="打开快捷 AI 输入"
          onPointerDown={handlePetPointerDown}
          onDoubleClick={(event) => {
            if (didDragRef.current) {
              didDragRef.current = false;
              return;
            }

            event.stopPropagation();
            void openQuickCommandPanel();
          }}
        >
          <PetRenderer spritesheetUrl={spritesheetUrl} state={petDisplayState} />
        </button>
        {showScaleHandle && <PetScaleHandle onPointerDown={handleScalePointerDown} />}
      </section>

      <TaskStatusLights steps={taskSteps} />
      {sentImagePreview && (
        <SentImagePreview src={sentImagePreview} isBubbleVisible={isBubbleVisible} />
      )}
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
          attachedImage={quickAttachedImage}
          selectedTargetId={quickTargetId}
          targetOptions={quickTargetOptions}
          skills={localSkills}
          selectedSkill={selectedSkill}
          onSkillMenuOpenChange={setIsQuickSkillMenuOpen}
          canAttachImage={canAttachImage}
          intent={quickIntent}
          isRunning={isQuickRunning}
          hasSession={Boolean(quickSessionId)}
          onPromptChange={setQuickPrompt}
          onAttachedImageChange={setQuickAttachedImage}
          onTargetChange={setQuickTargetId}
          onSkillSelect={setSelectedSkill}
          onIntentChange={setQuickIntent}
          onSubmit={submitQuickCommand}
          onClose={() => {
            setIsQuickCommandOpen(false);
            setQuickAttachedImage(null);
            setSelectedSkill(null);
            setIsQuickSkillMenuOpen(false);
          }}
        />
      )}

      {menuPosition && (
        <PetContextMenu
          actions={actions}
          context={context}
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => {
            setMenuPosition(null);
            setIsExpressionMenuOpen(false);
          }}
          onExpressionMenuOpenChange={setIsExpressionMenuOpen}
        />
      )}

      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => {
          setIsSettingsPanelOpen(false);
          // WHY：旧版本打开设置会误切 waiting，关闭时兜底恢复待机，避免动画卡住。
          setStateValue((current) => (current === 'waiting' ? 'idle' : current));
        }}
      />
    </main>
  );
}
