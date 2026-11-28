export type ElementId = 'fire' | 'water' | 'earth' | 'air';

export interface ElementDef {
  id: ElementId;
  name: string;
  tagline: string;
  /** Primary accent colour used for clothing trims, UI and effects. */
  color: number;
  glow: number;
  /** Region the player starts in. Configurable on purpose (GDD 4). */
  startRegion: string;
}

export const elements: Record<ElementId, ElementDef> = {
  fire: { id: 'fire', name: 'Fire', tagline: 'Aggression, destruction, burst.', color: 0xe8553a, glow: 0xffa24a, startRegion: 'emberreach' },
  water: { id: 'water', name: 'Water', tagline: 'Fluidity, adaptability, control.', color: 0x3a8fe8, glow: 0x8fe3ff, startRegion: 'glacemere' },
  earth: { id: 'earth', name: 'Earth', tagline: 'Strength, durability, defence.', color: 0x8a9a3c, glow: 0xd8c27a, startRegion: 'thornwall' },
  air: { id: 'air', name: 'Air', tagline: 'Speed, mobility, agility.', color: 0x8fd6c8, glow: 0xeafff9, startRegion: 'galecrest' },
};

export const elementOrder: ElementId[] = ['fire', 'water', 'earth', 'air'];
