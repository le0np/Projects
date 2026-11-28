import type { ElementId } from './elements';

/**
 * Discovery (GDD 4/13): each region has an elemental shrine and three waystones. Attuning at a shrine
 * unlocks that element's ability; lighting a waystone restores the player. Ids are stable save keys.
 */
export const discoveryConfig = {
  shrineRadius: 6.5,
  waystoneRadius: 3.2,
  waystonesPerRegion: 3,
  /** Waystones are scattered this far from the spawn, away from the camp and the shrine. */
  waystoneDistance: [26, 66] as [number, number],
};

export const waystoneNames: Record<ElementId, { kind: string; names: string[] }> = {
  fire: { kind: 'Ember Brazier', names: ['Brazier of the First Spark', 'Ashfall Brazier', 'Cinderwatch Brazier'] },
  water: { kind: 'Frost Lantern', names: ['Lantern of Still Water', 'Tidewake Lantern', 'Rimefall Lantern'] },
  earth: { kind: 'Rune Monolith', names: ['Monolith of Deep Roots', 'Mossheart Monolith', 'Stonesong Monolith'] },
  air: { kind: 'Wind Chime', names: ['Chime of the Open Sky', 'Galesong Chime', 'Featherfall Chime'] },
};

export const shrineId = (regionId: string) => `shrine:${regionId}`;
export const waystoneId = (regionId: string, i: number) => `waystone:${regionId}:${i}`;
