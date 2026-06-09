/** 桌宠精灵单帧尺寸，与 animation.ts 中 CELL 常量保持一致。 */
export const PET_CELL_WIDTH = 192;
export const PET_CELL_HEIGHT = 208;

/** 底部留白，避免 drop-shadow 被窗口裁切。 */
export const PET_SHELL_BOTTOM_INSET = 24;

/** 桌宠精灵右下角锚点距窗口底边的偏移。 */
export const PET_ANCHOR_BOTTOM = PET_SHELL_BOTTOM_INSET;

/** 窗口边缘预留像素。 */
export const PET_WINDOW_EDGE_PAD = 4;

/** 当前默认尺寸为 100%，最小缩至 50%。 */
export const MIN_PET_SCALE = 0.5;
export const MAX_PET_SCALE = 1;

export const PET_SCALE_STORAGE_KEY = 'codex-pet-clone:pet-scale';

/** 对角拖动多少像素对应从最小缩放到最大缩放。 */
export const PET_SCALE_DRAG_RANGE = 320;

const QUICK_COMMAND_PANEL_WIDTH = 280;
const QUICK_COMMAND_PANEL_HEIGHT = 184;
const QUICK_COMMAND_IMAGE_ROW_HEIGHT = 72;
const SENT_IMAGE_PREVIEW_HEIGHT = 72;
const ZOOMABLE_IMAGE_EXPANDED_SIZE = 280;
const SPEECH_BUBBLE_WIDTH = 240;
const SPEECH_BUBBLE_HEIGHT = 122;
const REMINDER_PANEL_WIDTH = 300;
const REMINDER_PANEL_HEIGHT = 260;
const REMINDER_INDICATOR_HEIGHT = 34;
const CONTEXT_MENU_WIDTH = 128;
const CONTEXT_SUBMENU_WIDTH = 136;
const CONTEXT_MENU_ITEM_HEIGHT = 34;
const SETTINGS_PANEL_WIDTH = 360;
const SETTINGS_PANEL_HEIGHT = 420;

export interface PetWindowLayoutState {
  scale: number;
  isBubbleVisible: boolean;
  isQuickCommandOpen: boolean;
  isSettingsPanelOpen: boolean;
  hasContextMenu: boolean;
  isExpressionMenuOpen: boolean;
  /** 快捷输入里已选图片预览行。 */
  hasQuickCommandImage: boolean;
  /** 快捷输入框正在展示 Skills 下拉菜单。 */
  hasQuickCommandSkillMenu: boolean;
  /** 气泡上方展示已发送图片。 */
  hasSentImagePreview: boolean;
  /** 桌宠头顶的提醒入口。 */
  hasReminderIndicator: boolean;
  /** 提醒任务列表面板。 */
  isReminderPanelOpen: boolean;
}

/** 仅桌宠本体时的窗口尺寸。 */
export function getCompactPetWindowSize(scale: number): { width: number; height: number } {
  return {
    width: Math.ceil(PET_CELL_WIDTH * scale + PET_WINDOW_EDGE_PAD),
    height: Math.ceil(PET_CELL_HEIGHT * scale + PET_SHELL_BOTTOM_INSET + PET_WINDOW_EDGE_PAD),
  };
}

/** 根据当前打开的浮层计算窗口最小包围盒。 */
export function computeRequiredPetWindowSize(state: PetWindowLayoutState): { width: number; height: number } {
  const petWidth = Math.ceil(PET_CELL_WIDTH * state.scale);
  const petHeight = Math.ceil(PET_CELL_HEIGHT * state.scale);
  const pad = PET_WINDOW_EDGE_PAD;
  const petStackBase = petHeight + PET_SHELL_BOTTOM_INSET;

  let width = petWidth + pad;
  let height = petStackBase + pad;

  if (state.isBubbleVisible) {
    width = Math.max(width, SPEECH_BUBBLE_WIDTH + pad * 2);
    height = petStackBase + 12 + SPEECH_BUBBLE_HEIGHT + pad;
  }

  if (state.hasReminderIndicator) {
    height = Math.max(height, petStackBase + REMINDER_INDICATOR_HEIGHT + pad);
  }

  if (state.isReminderPanelOpen) {
    width = Math.max(width, REMINDER_PANEL_WIDTH + pad * 2);
    height = Math.max(height, petStackBase + 12 + REMINDER_PANEL_HEIGHT + pad);
  }

  if (state.isQuickCommandOpen) {
    const quickCommandHeight =
      QUICK_COMMAND_PANEL_HEIGHT + (state.hasQuickCommandImage ? QUICK_COMMAND_IMAGE_ROW_HEIGHT + 8 : 0);
    width = Math.max(width, QUICK_COMMAND_PANEL_WIDTH + pad * 2);
    height = Math.max(height, petStackBase + 12 + quickCommandHeight + pad);
  }

  if (state.isBubbleVisible && state.isQuickCommandOpen) {
    const quickCommandHeight =
      QUICK_COMMAND_PANEL_HEIGHT + (state.hasQuickCommandImage ? QUICK_COMMAND_IMAGE_ROW_HEIGHT + 8 : 0);
    height = petStackBase + 12 + SPEECH_BUBBLE_HEIGHT + 12 + quickCommandHeight + pad;
  }

  if (state.hasSentImagePreview) {
    width = Math.max(width, ZOOMABLE_IMAGE_EXPANDED_SIZE + pad * 2);
    height = Math.max(height, petStackBase + 12 + SENT_IMAGE_PREVIEW_HEIGHT + pad);
  }

  if (state.isBubbleVisible && state.hasSentImagePreview) {
    height = Math.max(
      height,
      petStackBase + 12 + SENT_IMAGE_PREVIEW_HEIGHT + 8 + SPEECH_BUBBLE_HEIGHT + pad,
    );
  }

  if (state.isSettingsPanelOpen) {
    width = Math.max(width, SETTINGS_PANEL_WIDTH + pad * 2);
    height = Math.max(height, petStackBase + 12 + SETTINGS_PANEL_HEIGHT + pad);
  }

  if (state.hasContextMenu) {
    width = Math.max(width, CONTEXT_MENU_WIDTH + CONTEXT_SUBMENU_WIDTH + 24 + pad);
    height = Math.max(height, petStackBase + 8 * CONTEXT_MENU_ITEM_HEIGHT + 40 + pad);
  }

  if (state.isExpressionMenuOpen) {
    width = Math.max(width, CONTEXT_MENU_WIDTH + CONTEXT_SUBMENU_WIDTH + 24 + pad);
    height = Math.max(height, petStackBase + 8 * CONTEXT_MENU_ITEM_HEIGHT + 40 + pad);
  }

  return { width, height };
}
