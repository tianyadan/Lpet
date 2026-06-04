import { useCallback, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

interface PanelGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseDraggableResizablePanelOptions {
  initialGeometry: PanelGeometry;
  minWidth: number;
  minHeight: number;
  viewportPadding: number;
}

interface DragSnapshot {
  pointerId: number;
  pointerStartX: number;
  pointerStartY: number;
  geometryStart: PanelGeometry;
}

type ResizeSnapshot = DragSnapshot;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampGeometry(
  geometry: PanelGeometry,
  minWidth: number,
  minHeight: number,
  viewportPadding: number,
): PanelGeometry {
  const maxWidth = Math.max(minWidth, window.innerWidth - viewportPadding * 2);
  const maxHeight = Math.max(minHeight, window.innerHeight - viewportPadding * 2);
  const width = clamp(geometry.width, minWidth, maxWidth);
  const height = clamp(geometry.height, minHeight, maxHeight);

  return {
    width,
    height,
    left: clamp(geometry.left, viewportPadding, Math.max(viewportPadding, window.innerWidth - width - viewportPadding)),
    top: clamp(geometry.top, viewportPadding, Math.max(viewportPadding, window.innerHeight - height - viewportPadding)),
  };
}

export function useDraggableResizablePanel({
  initialGeometry,
  minWidth,
  minHeight,
  viewportPadding,
}: UseDraggableResizablePanelOptions) {
  const [geometry, setGeometry] = useState<PanelGeometry>(() =>
    clampGeometry(initialGeometry, minWidth, minHeight, viewportPadding),
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      const snapshot: DragSnapshot = {
        pointerId: event.pointerId,
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        geometryStart: geometry,
      };
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      function handlePointerMove(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== snapshot.pointerId) {
          return;
        }

        const nextGeometry: PanelGeometry = {
          ...snapshot.geometryStart,
          left: snapshot.geometryStart.left + pointerEvent.clientX - snapshot.pointerStartX,
          top: snapshot.geometryStart.top + pointerEvent.clientY - snapshot.pointerStartY,
        };
        setGeometry(clampGeometry(nextGeometry, minWidth, minHeight, viewportPadding));
      }

      function handlePointerUp(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== snapshot.pointerId) {
          return;
        }
        target.releasePointerCapture(snapshot.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      }

      // WHY：面板在透明 Electron 窗口内移动，不使用 app-region drag，避免拖动时输入框和按钮被系统窗口拖拽吞掉事件。
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [geometry, minHeight, minWidth, viewportPadding],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const snapshot: ResizeSnapshot = {
        pointerId: event.pointerId,
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        geometryStart: geometry,
      };
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      function handlePointerMove(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== snapshot.pointerId) {
          return;
        }

        const nextGeometry: PanelGeometry = {
          ...snapshot.geometryStart,
          width: snapshot.geometryStart.width + pointerEvent.clientX - snapshot.pointerStartX,
          height: snapshot.geometryStart.height + pointerEvent.clientY - snapshot.pointerStartY,
        };
        setGeometry(clampGeometry(nextGeometry, minWidth, minHeight, viewportPadding));
      }

      function handlePointerUp(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== snapshot.pointerId) {
          return;
        }
        target.releasePointerCapture(snapshot.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      }

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [geometry, minHeight, minWidth, viewportPadding],
  );

  const panelStyle: CSSProperties = {
    left: geometry.left,
    top: geometry.top,
    width: geometry.width,
    height: geometry.height,
  };

  return {
    panelStyle,
    startDrag,
    startResize,
  };
}
