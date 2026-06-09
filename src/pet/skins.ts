import nekoStarDefinition from '../assets/pets/neko-star/pet.json';
import nekoStarSpritesheetUrl from '../assets/pets/neko-star/spritesheet.webp';
import type { PetDefinition } from './types';

const nekoStar = nekoStarDefinition as PetDefinition;

export const PET_SKIN_STORAGE_KEY = 'lpet:selected-skin-id';

export const builtInPetSkins: PetSkinOption[] = [
  {
    id: nekoStar.id,
    displayName: nekoStar.displayName,
    description: nekoStar.description,
    spritesheetUrl: nekoStarSpritesheetUrl,
    source: 'built-in',
  },
];
