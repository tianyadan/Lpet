import { useEffect, useRef } from 'react';

/** 可接收鼠标交互的浮层选择器，空白透明区域应穿透到桌面。 */
const INTERACTIVE_SELECTOR =
  '.pet-shell, .quick-command, .pet-speech-bubble, .pet-sent-image, .zoomable-image-expanded, .task-status-lights, .reminder-indicator, .reminder-task-panel, .pet-menu-container, .settings-panel';

/**
 * 根据鼠标是否悬停在桌宠/面板上，动态切换 Electron 窗口鼠标穿透。
 * WHY：静态 setIgnoreMouseEvents(true) 会让桌宠本体也点不到；只在空白区穿透才正确。
 */
export function usePetMousePassthrough(enabled: boolean, forceInteractive = false) {
  const forceInteractiveRef = useRef(forceInteractive);

  forceInteractiveRef.current = forceInteractive;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let rafId = 0;

    function updatePassthrough(clientX: number, clientY: number) {
      if (forceInteractiveRef.current) {
        void window.petDesktop?.setMousePassthrough(false);
        return;
      }

      const hitTarget = document.elementFromPoint(clientX, clientY);
      const isInteractive = Boolean(hitTarget?.closest(INTERACTIVE_SELECTOR));
      void window.petDesktop?.setMousePassthrough(!isInteractive);
    }

    function handleMouseMove(event: MouseEvent) {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updatePassthrough(event.clientX, event.clientY);
      });
    }

    function handleMouseLeave() {
      if (forceInteractiveRef.current) {
        return;
      }

      void window.petDesktop?.setMousePassthrough(true);
    }

    // 初始允许交互，避免启动后第一下点击无效。
    void window.petDesktop?.setMousePassthrough(false);
    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      void window.petDesktop?.setMousePassthrough(false);
    };
  }, [enabled]);
}
