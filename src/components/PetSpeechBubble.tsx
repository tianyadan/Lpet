interface PetSpeechBubbleProps {
  text: string;
  isVisible: boolean;
  isRunning: boolean;
  onClose: () => void;
  onInterrupt: () => void;
}

export function PetSpeechBubble({ text, isVisible, isRunning, onClose, onInterrupt }: PetSpeechBubbleProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <aside className="pet-speech-bubble" aria-label="AI 输出气泡">
      <button type="button" className="pet-speech-bubble-close" onClick={onClose} aria-label="关闭输出气泡">
        ×
      </button>
      <div className="pet-speech-bubble-content">{text || '正在等待 AI 输出...'}</div>
      {isRunning && (
        <button type="button" className="pet-speech-bubble-interrupt" onClick={onInterrupt}>
          中断
        </button>
      )}
    </aside>
  );
}
