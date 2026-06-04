import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { PET_SHELL_BOTTOM_INSET } from '../pet/constants';

/** 移动超过该像素才视为拖拽，避免和单击/双击冲突。 */
const PET_DRAG_THRESHOLD = 5;

interface UsePetDragOptions {
  disabled?: boolean;
  petScale?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDirectionChange?: (direction: 'left' | 'right' | null) => void;
}

export function usePetDrag({
  disabled = false,
  petScale = 1,
  onDragStart,
  onDragEnd,
  onDirectionChange,
}: UsePetDragOptions) {
  const isDraggingRef = useRef(false);
  const isStartingDragRef = useRef(false);
  const didDragRef = useRef(false);
  const pointerStartRef = useRef({ clientX: 0, clientY: 0, screenX: 0, screenY: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const lastScreenXRef = useRef(0);
  const petScaleRef = useRef(petScale);

  petScaleRef.current = petScale;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) {
        return;
      }

      const pointerId = event.pointerId;
      const targetElement = event.currentTarget;

      pointerStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      };
      lastScreenXRef.current = event.screenX;
      isDraggingRef.current = false;
      isStartingDragRef.current = false;
      didDragRef.current = false;

      function applyPointerMove(pointerEvent: PointerEvent) {
        pointerEvent.preventDefault();

        const anchorX = pointerEvent.screenX - grabOffsetRef.current.x;
        const anchorY = pointerEvent.screenY - grabOffsetRef.current.y;

        // WHY：按桌宠锚点定位窗口，而不是移动窗口左上角，否则窗口触顶后桌宠仍到不了屏幕上方。
        void window.petDesktop?.setPetAnchorPosition(anchorX, anchorY, petScaleRef.current);

        const frameDeltaX = pointerEvent.screenX - lastScreenXRef.current;
        lastScreenXRef.current = pointerEvent.screenX;

        if (frameDeltaX < -1) {
          onDirectionChange?.('left');
        } else if (frameDeltaX > 1) {
          onDirectionChange?.('right');
        }
      }

      async function startDrag(pointerEvent: PointerEvent) {
        if (isDraggingRef.current || isStartingDragRef.current) {
          return;
        }

        isStartingDragRef.current = true;

        const bounds = await window.petDesktop?.getWindowBounds();
        if (bounds) {
          const anchorX = bounds.x + bounds.width;
          const anchorY = bounds.y + bounds.height - PET_SHELL_BOTTOM_INSET;
          grabOffsetRef.current = {
            x: pointerEvent.screenX - anchorX,
            y: pointerEvent.screenY - anchorY,
          };
        }

        isStartingDragRef.current = false;
        isDraggingRef.current = true;
        didDragRef.current = true;
        targetElement.setPointerCapture(pointerId);
        onDragStart?.();
        applyPointerMove(pointerEvent);
      }

      function handlePointerMove(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) {
          return;
        }

        const deltaX = pointerEvent.clientX - pointerStartRef.current.clientX;
        const deltaY = pointerEvent.clientY - pointerStartRef.current.clientY;

        if (!isDraggingRef.current) {
          if (Math.hypot(deltaX, deltaY) < PET_DRAG_THRESHOLD) {
            return;
          }

          void startDrag(pointerEvent);
          return;
        }

        applyPointerMove(pointerEvent);
      }

      function handlePointerUp(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) {
          return;
        }

        if (targetElement.hasPointerCapture(pointerId)) {
          targetElement.releasePointerCapture(pointerId);
        }

        targetElement.removeEventListener('pointermove', handlePointerMove);
        targetElement.removeEventListener('pointerup', handlePointerUp);

        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onDragEnd?.();
        }
      }

      targetElement.addEventListener('pointermove', handlePointerMove);
      targetElement.addEventListener('pointerup', handlePointerUp);
    },
    [disabled, onDirectionChange, onDragEnd, onDragStart],
  );

  return {
    handlePetPointerDown: handlePointerDown,
    didDragRef,
  };
}
