import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDraggableResizablePanel } from '../hooks/useDraggableResizablePanel';
import { extractAssistantText, extractSessionId } from '../utils/codexOutput';

interface CodexPanelProps {
  isOpen: boolean;
  detached?: boolean;
  onClose: () => void;
  onRunningChange: (isRunning: boolean) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CodexPanel({ isOpen, detached = false, onClose, onRunningChange }: CodexPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [target, setTarget] = useState<CodexRunTarget>('codex-cli');
  const [installations, setInstallations] = useState<CodexInstallationCheck | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const startupTimerRef = useRef<number | null>(null);
  const rawRunOutputRef = useRef('');
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const selectedTargetInstalled = installations?.cli.installed === true;
  const selectedTargetStatusText =
    installations ? (installations.cli.installed ? 'CLI 已安装' : 'CLI 未安装') : '检测中';
  const { panelStyle, startDrag, startResize } = useDraggableResizablePanel({
    initialGeometry: {
      left: 18,
      top: 18,
      width: 360,
      height: 360,
    },
    minWidth: 280,
    minHeight: 280,
    viewportPadding: 8,
  });
  const startDetachedResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const pointerStartX = event.clientX;
    const pointerStartY = event.clientY;
    const widthStart = window.innerWidth;
    const heightStart = window.innerHeight;
    const targetElement = event.currentTarget;
    targetElement.setPointerCapture(pointerId);

    function handlePointerMove(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }

      // WHY：独立小窗已经是单独 BrowserWindow，缩放必须交给主进程调整原生窗口尺寸，而不是只改内部 DOM。
      void window.petDesktop?.resizeCurrentWindow(
        widthStart + pointerEvent.clientX - pointerStartX,
        heightStart + pointerEvent.clientY - pointerStartY,
      );
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }
      targetElement.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, []);

  function clearStartupTimer() {
    if (startupTimerRef.current !== null) {
      window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
    }
  }

  function updateMessage(messageId: string, text: string) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, text } : message)),
    );
  }

  function appendSystemMessage(text: string) {
    setMessages((current) => [...current, { id: createMessageId('system'), role: 'system', text }]);
  }

  useEffect(() => {
    const unsubscribe = window.petDesktop?.onCodexEvent((event) => {
      if (event.type === 'start') {
        clearStartupTimer();
        setIsRunning(true);
        onRunningChange(true);
        return;
      }

      if (event.type === 'stdout' || event.type === 'stderr') {
        rawRunOutputRef.current += event.text;

        const nextSessionId = extractSessionId(rawRunOutputRef.current);
        if (nextSessionId) {
          setSessionId(nextSessionId);
        }

        const assistantText = extractAssistantText(rawRunOutputRef.current);
        if (assistantText && activeAssistantMessageIdRef.current) {
          updateMessage(activeAssistantMessageIdRef.current, assistantText);
        }
        return;
      }

      if (event.type === 'error') {
        clearStartupTimer();
        setIsRunning(false);
        onRunningChange(false);
        if (activeAssistantMessageIdRef.current) {
          updateMessage(activeAssistantMessageIdRef.current, `[error] ${event.message}`);
        } else {
          appendSystemMessage(`[error] ${event.message}`);
        }
        activeAssistantMessageIdRef.current = null;
        return;
      }

      if (event.type === 'cancelled') {
        clearStartupTimer();
        setIsRunning(false);
        onRunningChange(false);
        appendSystemMessage('已停止当前 Codex 任务。');
        activeAssistantMessageIdRef.current = null;
        return;
      }

      if (event.type === 'exit') {
        clearStartupTimer();
        setIsRunning(false);
        onRunningChange(false);

        const assistantText = extractAssistantText(rawRunOutputRef.current);
        if (activeAssistantMessageIdRef.current && assistantText) {
          updateMessage(activeAssistantMessageIdRef.current, assistantText);
        } else if (activeAssistantMessageIdRef.current && event.code !== 0) {
          updateMessage(activeAssistantMessageIdRef.current, `[exit] code=${event.code ?? 'null'} signal=${event.signal ?? 'null'}`);
        }
        activeAssistantMessageIdRef.current = null;
      }
    });

    return () => {
      clearStartupTimer();
      unsubscribe?.();
    };
  }, [onRunningChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // WHY：发送前先刷新本机能力，避免 CLI 未安装时进入“运行中”但实际没有进程输出的假状态。
    void window.petDesktop?.checkCodexInstallations().then((status) => {
      setInstallations(status);
    });
  }, [isOpen]);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [messages]);

  if (!isOpen) {
    return null;
  }

  async function submitPrompt() {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isRunning) {
      return;
    }

    if (target === 'codex-cli' && installations?.cli.installed === false) {
      appendSystemMessage('未检测到 Codex CLI。请先在“设置”里确认安装状态，或安装 CLI 后重试。');
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      text: normalizedPrompt,
    };
    const assistantMessage: ChatMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      text: '正在等待 Codex 回复...',
    };

    rawRunOutputRef.current = '';
    activeAssistantMessageIdRef.current = assistantMessage.id;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt('');
    setIsRunning(true);
    onRunningChange(true);
    startupTimerRef.current = window.setTimeout(() => {
      if (activeAssistantMessageIdRef.current) {
        updateMessage(activeAssistantMessageIdRef.current, 'Codex CLI 暂时没有返回内容。你可以点“停止”，或稍等片刻。');
      }
    }, 8000);

    try {
      await window.petDesktop?.runCodex(normalizedPrompt, target, sessionId);
    } catch (error) {
      clearStartupTimer();
      setIsRunning(false);
      onRunningChange(false);
      const message = error instanceof Error ? error.message : String(error);
      if (activeAssistantMessageIdRef.current) {
        updateMessage(activeAssistantMessageIdRef.current, `[error] ${message}`);
      }
      activeAssistantMessageIdRef.current = null;
    }
  }

  async function cancel() {
    clearStartupTimer();
    setIsRunning(false);
    onRunningChange(false);
    await window.petDesktop?.cancelCodex();
  }

  function resetConversation() {
    if (isRunning) {
      return;
    }
    setSessionId(null);
    setMessages([]);
    rawRunOutputRef.current = '';
    activeAssistantMessageIdRef.current = null;
  }

  return (
    <aside
      className={detached ? 'codex-panel codex-panel-detached' : 'codex-panel'}
      style={detached ? undefined : panelStyle}
      aria-label="Codex CLI 小窗"
    >
      <header
        className="codex-panel-header codex-panel-drag-handle"
        onPointerDown={detached ? undefined : startDrag}
      >
        <span>Codex Agent</span>
        <div className="codex-header-actions" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className="codex-text-button" disabled={isRunning} onClick={resetConversation}>
            新会话
          </button>
          <button type="button" className="codex-icon-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
      </header>

      <div className="codex-target-bar">
        <label className="codex-target-label" htmlFor="codex-target">
          目标
        </label>
        <select
          id="codex-target"
          className="codex-target-select"
          value={target}
          disabled={isRunning}
          onChange={(event) => setTarget(event.target.value as CodexRunTarget)}
        >
          <option value="codex-cli">Codex CLI{installations?.cli.installed === false ? '（未安装）' : ''}</option>
        </select>
        <span className={selectedTargetInstalled ? 'codex-target-status codex-target-status-ready' : 'codex-target-status'}>
          {selectedTargetStatusText}
        </span>
      </div>

      <div ref={outputRef} className="codex-output codex-chat-output">
        {messages.length === 0 ? (
          <div className="codex-empty-output">输入消息后会在这里连续对话。</div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`codex-chat-message codex-chat-message-${message.role}`}>
              <span className={`codex-chat-dot codex-chat-dot-${message.role}`} />
              <div className="codex-chat-bubble">{message.text}</div>
            </article>
          ))
        )}
      </div>

      <textarea
        className="codex-input"
        value={prompt}
        disabled={isRunning}
        placeholder={sessionId ? '继续追问当前 Codex 会话...' : '输入要交给本机 Codex CLI 执行的任务...'}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            void submitPrompt();
          }
        }}
      />

      <div className="codex-panel-actions">
        <button type="button" className="codex-primary-button" disabled={isRunning || !prompt.trim()} onClick={submitPrompt}>
          {isRunning ? '运行中' : sessionId ? '继续发送' : '发送'}
        </button>
        <button type="button" className="codex-secondary-button" disabled={!isRunning} onClick={cancel}>
          停止
        </button>
      </div>

      <div
        className="codex-panel-resize-handle"
        role="separator"
        aria-label="调整 Codex 小窗大小"
        onPointerDown={detached ? startDetachedResize : startResize}
      />
    </aside>
  );
}
