interface PetSpeechBubbleProps {
  text: string;
  isVisible: boolean;
  isRunning: boolean;
  onClose: () => void;
  onInterrupt: () => void;
  onReply: () => void;
}

export function PetSpeechBubble({ text, isVisible, isRunning, onClose, onInterrupt, onReply }: PetSpeechBubbleProps) {
  if (!isVisible) {
    return null;
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
          <button type="button" className="pet-speech-bubble-reply" onClick={onReply}>
            继续回复
          </button>
        )}
      </div>
    </aside>
  );
}
