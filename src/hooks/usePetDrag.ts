import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

/** 移动超过该像素才视为拖拽，避免和单击/双击冲突。 */
const PET_DRAG_THRESHOLD = 5;

interface UsePetDragOptions {
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDirectionChange?: (direction: 'left' | 'right' | null) => void;
}

export function usePetDrag({ disabled = false, onDragStart, onDragEnd, onDirectionChange }: UsePetDragOptions) {
  const isDraggingRef = useRef(false);
  const isStartingDragRef = useRef(false);
  const didDragRef = useRef(false);
  const pointerStartRef = useRef({ clientX: 0, clientY: 0, screenX: 0, screenY: 0 });
  const windowStartRef = useRef({ x: 0, y: 0 });
  const lastScreenXRef = useRef(0);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) {
        return;
      }

      const pointerId = event.pointerId;
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

        const screenDeltaX = pointerEvent.screenX - pointerStartRef.current.screenX;
        const screenDeltaY = pointerEvent.screenY - pointerStartRef.current.screenY;

        // WHY：透明桌宠窗口必须走主进程 setPosition，不能用 CSS 位移代替。
        void window.petDesktop?.setWindowPosition(
          windowStartRef.current.x + screenDeltaX,
          windowStartRef.current.y + screenDeltaY,
        );

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
          windowStartRef.current = { x: bounds.x, y: bounds.y };
        }

        isStartingDragRef.current = false;
        isDraggingRef.current = true;
        didDragRef.current = true;
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

        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onDragEnd?.();
        }
      }

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [disabled, onDirectionChange, onDragEnd, onDragStart],
  );

  return {
    handlePetPointerDown: handlePointerDown,
    didDragRef,
  };
}
