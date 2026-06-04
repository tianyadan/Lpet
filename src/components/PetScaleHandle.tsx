import type { PointerEvent as ReactPointerEvent } from 'react';

interface PetScaleHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** 悬停桌宠时显示的缩放把手，样式对齐 Codex 小窗 resize 把手。 */
export function PetScaleHandle({ onPointerDown }: PetScaleHandleProps) {
  return (
    <button
      type="button"
      className="pet-scale-handle"
      aria-label="拖动缩放桌宠"
      onPointerDown={onPointerDown}
    />
  );
}
