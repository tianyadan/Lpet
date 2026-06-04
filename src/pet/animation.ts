import type { PetAnimationFrame, PetAnimationState } from './types';

const STATE_ROWS: Record<PetAnimationState, { rowIndex: number; frameCount: number; frameMs: number; tailMs: number }> = {
  idle: { rowIndex: 0, frameCount: 6, frameMs: 140, tailMs: 320 },
  'running-right': { rowIndex: 1, frameCount: 8, frameMs: 120, tailMs: 220 },
  'running-left': { rowIndex: 2, frameCount: 8, frameMs: 120, tailMs: 220 },
  waving: { rowIndex: 3, frameCount: 4, frameMs: 140, tailMs: 280 },
  jumping: { rowIndex: 4, frameCount: 5, frameMs: 140, tailMs: 280 },
  failed: { rowIndex: 5, frameCount: 8, frameMs: 140, tailMs: 240 },
  waiting: { rowIndex: 6, frameCount: 6, frameMs: 150, tailMs: 260 },
  running: { rowIndex: 7, frameCount: 6, frameMs: 120, tailMs: 220 },
  review: { rowIndex: 8, frameCount: 6, frameMs: 150, tailMs: 280 },
};

export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 9;
export const CELL_WIDTH = 192;
export const CELL_HEIGHT = 208;

export function buildFrames(state: PetAnimationState): PetAnimationFrame[] {
  const spec = STATE_ROWS[state];
  return Array.from({ length: spec.frameCount }, (_, columnIndex) => ({
    rowIndex: spec.rowIndex,
    columnIndex,
    durationMs: columnIndex === spec.frameCount - 1 ? spec.tailMs : spec.frameMs,
  }));
}

export function getBackgroundPosition(frame: PetAnimationFrame): string {
  return `${(frame.columnIndex / (ATLAS_COLUMNS - 1)) * 100}% ${(frame.rowIndex / (ATLAS_ROWS - 1)) * 100}%`;
}
