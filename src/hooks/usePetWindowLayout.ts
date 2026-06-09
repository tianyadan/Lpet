import { useLayoutEffect, useRef } from 'react';
import { computeRequiredPetWindowSize, type PetWindowLayoutState } from '../pet/constants';

/** 立即按浮层状态调整 Electron 窗口尺寸，打开面板前应 await 以避免首帧裁切。 */
export async function applyPetWindowLayout(state: PetWindowLayoutState): Promise<void> {
  const nextSize = computeRequiredPetWindowSize(state);
  await window.petDesktop?.setWindowSizeKeepBottomRight(nextSize.width, nextSize.height);
}

/** 随桌宠缩放和浮层开关动态调整窗口大小，并保持右下角锚点不动。 */
export function usePetWindowLayout(state: PetWindowLayoutState) {
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);

  // WHY：必须在浏览器绘制前改窗口尺寸，useEffect 会导致首帧面板被裁切。
  useLayoutEffect(() => {
    const nextSize = computeRequiredPetWindowSize(state);
    const lastSize = lastSizeRef.current;

    if (lastSize && lastSize.width === nextSize.width && lastSize.height === nextSize.height) {
      return;
    }

    lastSizeRef.current = nextSize;
    void applyPetWindowLayout(state);
  }, [
    state.scale,
    state.isBubbleVisible,
    state.isQuickCommandOpen,
    state.isSettingsPanelOpen,
    state.hasContextMenu,
    state.isExpressionMenuOpen,
    state.hasQuickCommandImage,
    state.hasSentImagePreview,
    state.hasReminderIndicator,
    state.isReminderPanelOpen,
  ]);
}
