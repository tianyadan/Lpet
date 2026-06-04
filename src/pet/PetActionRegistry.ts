import type { PetAction } from './types';

export class PetActionRegistry {
  private readonly actions = new Map<string, PetAction>();

  register(action: PetAction): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Pet action already registered: ${action.id}`);
    }
    this.actions.set(action.id, action);
  }

  list(): PetAction[] {
    return Array.from(this.actions.values());
  }
}
