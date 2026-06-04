import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MAX_PET_SCALE,
  MIN_PET_SCALE,
  PET_SCALE_DRAG_RANGE,
  PET_SCALE_STORAGE_KEY,
  PET_SHELL_BOTTOM_INSET,
} from '../pet/constants';

function clampScale(value: number): number {
  return Math.min(MAX_PET_SCALE, Math.max(MIN_PET_SCALE, value));
}

function readStoredScale(): number {
  try {
    const stored = localStorage.getItem(PET_SCALE_STORAGE_KEY);
    if (!stored) {
      return MAX_PET_SCALE;
    }

    const parsed = Number.parseFloat(stored);
    return Number.isFinite(parsed) ? clampScale(parsed) : MAX_PET_SCALE;
  } catch {
    return MAX_PET_SCALE;
  }
}

export function usePetScale() {
  const [scale, setScale] = useState(readStoredScale);
  const [isHovered, setIsHovered] = useState(false);
  const [isScaling, setIsScaling] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PET_SCALE_STORAGE_KEY, String(scale));
    } catch {
      // 本地存储不可用时仍允许当次会话缩放，只是不会持久化。
    }
  }, [scale]);

  const handleScalePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const pointerId = event.pointerId;
      const pointerStartX = event.clientX;
      const pointerStartY = event.clientY;
      const scaleStart = scale;
      const targetElement = event.currentTarget;

      targetElement.setPointerCapture(pointerId);
      setIsScaling(true);

      function handlePointerMove(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) {
          return;
        }

        // WHY：锚点在右下，把手在左上；向右下拖动放大，向左上拖动缩小。
        const diagonalDelta =
          pointerEvent.clientX - pointerStartX + (pointerEvent.clientY - pointerStartY);
        const scaleDelta = (diagonalDelta / PET_SCALE_DRAG_RANGE) * (MAX_PET_SCALE - MIN_PET_SCALE);
        setScale(clampScale(scaleStart + scaleDelta));
      }

      function handlePointerUp(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) {
          return;
        }

        targetElement.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        setIsScaling(false);
      }

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [scale],
  );

  const petStageStyle = {
    '--pet-scale': scale,
    '--pet-shell-bottom': `${PET_SHELL_BOTTOM_INSET}px`,
  } as CSSProperties;

  return {
    scale,
    isHovered,
    setIsHovered,
    isScaling,
    showScaleHandle: isHovered || isScaling,
    handleScalePointerDown,
    petStageStyle,
  };
}
