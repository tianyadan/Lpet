import { useState } from 'react';

interface PetSpeechBubbleProps {
  text: string;
  isVisible: boolean;
  isRunning: boolean;
  onClose: () => void;
  onInterrupt: () => void;
  onReply: () => void;
}

export function PetSpeechBubble({ text, isVisible, isRunning, onClose, onInterrupt, onReply }: PetSpeechBubbleProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  if (!isVisible) {
    return null;
  }

  async function copyCurrentText() {
    const content = text.trim();
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }

    window.setTimeout(() => setCopyStatus('idle'), 1400);
  }

  return (
    <aside className="pet-speech-bubble" aria-label="AI 输出气泡">
      <button type="button" className="pet-speech-bubble-close" onClick={onClose} aria-label="关闭对话并结束上下文">
        ×
      </button>
      <div className="pet-speech-bubble-content">{text || '正在等待 AI 输出...'}</div>
      <div className="pet-speech-bubble-actions">
        {isRunning ? (
          <button type="button" className="pet-speech-bubble-interrupt" onClick={onInterrupt}>
            中断
          </button>
        ) : (
          <>
            <button
              type="button"
              className="pet-speech-bubble-copy"
              disabled={!text.trim()}
              onClick={copyCurrentText}
            >
              {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : '复制'}
            </button>
            <button type="button" className="pet-speech-bubble-reply" onClick={onReply}>
              继续回复
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
