/** 桌宠精灵单帧尺寸，与 animation.ts 中 CELL 常量保持一致。 */
export const PET_CELL_WIDTH = 192;
export const PET_CELL_HEIGHT = 208;

/** 桌宠锚点在窗口右下角的基础偏移。 */
export const PET_ANCHOR_RIGHT = 32;
export const PET_ANCHOR_BOTTOM = 34;

/** 当前默认尺寸为 100%，最小缩至 50%。 */
export const MIN_PET_SCALE = 0.5;
export const MAX_PET_SCALE = 1;

export const PET_SCALE_STORAGE_KEY = 'codex-pet-clone:pet-scale';

/** 对角拖动多少像素对应从最小缩放到最大缩放。 */
export const PET_SCALE_DRAG_RANGE = 320;
