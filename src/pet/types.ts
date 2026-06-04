export type PetAnimationState =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

export interface PetDefinition {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
}

export interface PetAnimationFrame {
  rowIndex: number;
  columnIndex: number;
  durationMs: number;
}

export interface PetActionContext {
  setState: (state: PetAnimationState, durationMs?: number) => void;
  openCodexPanel: () => Promise<void> | void;
  openSettingsPanel: () => void;
  hide: () => Promise<void>;
  quit: () => Promise<void>;
}

export interface PetAction {
  id: string;
  label: string;
  group?: 'expression';
  run: (context: PetActionContext) => Promise<void> | void;
}
