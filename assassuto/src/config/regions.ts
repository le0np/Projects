import type { ElementId } from './elements';

export type PropKind = 'oak' | 'pine' | 'birch' | 'rock' | 'spire' | 'crystal' | 'pillar' | 'skyIsland';

export interface PropRule {
  kind: PropKind;
  count: number;
  /** Prop is only placed where normalised height (0 = water level, 1 = peaks) is within this range. */
  heightRange: [number, number];
  maxSlope: number;
  scale: [number, number];
  /** Keep this clear radius around the spawn point. */
  clearRadius?: number;
}

export interface RegionDef {
  id: string;
  element: ElementId;
  name: string;
  subtitle: string;
  /** Compass direction in the future connected world; used to place regions relative to each other. */
  direction: 'north' | 'south' | 'east' | 'west';
  seed: number;
  terrain: {
    size: number;
    segments: number;
    baseHeight: number;
    hillAmplitude: number;
    hillScale: number;
    ridgeAmplitude: number;
    /** Height of the mountain wall that bounds the playable area. */
    rimHeight: number;
    /** Radius of the flattened area around spawn. */
    plateauRadius: number;
    waterLevel: number | null;
  };
  palette: {
    low: number;
    mid: number;
    high: number;
    cliff: number;
    shore: number;
    water: number;
    grass: number;
    foliage: number[];
    trunk: number;
    rock: number;
    accent: number;
  };
  atmosphere: {
    skyTop: number;
    skyHorizon: number;
    cloud: number;
    cloudShadow: number;
    cloudCover: number;
    sunElevation: number;
    sunAzimuth: number;
    sunColor: number;
    sunIntensity: number;
    hemiSky: number;
    hemiGround: number;
    fogColor: number;
    fogDensity: number;
    exposure: number;
  };
  grassDensity: number;
  props: PropRule[];
  spawn: { x: number; z: number };
}

const S = 340;
const SEG = 170;

export const regions: Record<string, RegionDef> = {
  thornwall: {
    id: 'thornwall', element: 'earth', name: 'Thornwall Highlands', subtitle: 'The Western Reach', direction: 'west', seed: 4127,
    terrain: { size: S, segments: SEG, baseHeight: 4, hillAmplitude: 9, hillScale: 0.011, ridgeAmplitude: 7, rimHeight: 55, plateauRadius: 24, waterLevel: 1.2 },
    palette: { low: 0x6f9e48, mid: 0x8db35a, high: 0xa9a27a, cliff: 0x7b6e5e, shore: 0xc9b98a, water: 0x3f8fa8, grass: 0x7fb04e, foliage: [0x4f8a3a, 0x6aa14a, 0x87b85a], trunk: 0x5e4433, rock: 0x8c8478, accent: 0xd8c27a },
    atmosphere: { skyTop: 0x3f86d8, skyHorizon: 0xcfe6f2, cloud: 0xffffff, cloudShadow: 0xb8c8de, cloudCover: 0.42, sunElevation: 38, sunAzimuth: 150, sunColor: 0xfff1d6, sunIntensity: 3.0, hemiSky: 0xbfdcff, hemiGround: 0x5d6b3a, fogColor: 0xcfe2ee, fogDensity: 0.0042, exposure: 0.95 },
    grassDensity: 1,
    props: [
      { kind: 'oak', count: 140, heightRange: [0.05, 0.55], maxSlope: 0.45, scale: [0.85, 1.5], clearRadius: 14 },
      { kind: 'pillar', count: 26, heightRange: [0.1, 0.7], maxSlope: 0.6, scale: [0.8, 1.8], clearRadius: 18 },
      { kind: 'rock', count: 120, heightRange: [0.0, 1.0], maxSlope: 1.5, scale: [0.5, 2.4], clearRadius: 6 },
    ],
    spawn: { x: 0, z: 10 },
  },
  emberreach: {
    id: 'emberreach', element: 'fire', name: 'Emberreach Canyons', subtitle: 'The Southern Reach', direction: 'south', seed: 9012,
    terrain: { size: S, segments: SEG, baseHeight: 3, hillAmplitude: 6, hillScale: 0.014, ridgeAmplitude: 16, rimHeight: 60, plateauRadius: 22, waterLevel: null },
    palette: { low: 0xb5683f, mid: 0xcf8a52, high: 0xd9a06a, cliff: 0x5a2f2a, shore: 0x7a3a2c, water: 0xff6a2a, grass: 0xc9894a, foliage: [0xd9733a, 0xb8502e, 0xe39a4a], trunk: 0x3a2522, rock: 0x4a3532, accent: 0xff8a3a },
    atmosphere: { skyTop: 0x6a4a8c, skyHorizon: 0xf2b07a, cloud: 0xffd2a8, cloudShadow: 0xb06a6a, cloudCover: 0.35, sunElevation: 16, sunAzimuth: 200, sunColor: 0xffc48a, sunIntensity: 3.4, hemiSky: 0xffc8a0, hemiGround: 0x5a2a20, fogColor: 0xe9a87e, fogDensity: 0.005, exposure: 0.9 },
    grassDensity: 0.35,
    props: [
      { kind: 'spire', count: 70, heightRange: [0.0, 0.8], maxSlope: 0.8, scale: [0.8, 2.2], clearRadius: 16 },
      { kind: 'crystal', count: 60, heightRange: [0.0, 0.6], maxSlope: 0.7, scale: [0.6, 1.6], clearRadius: 8 },
      { kind: 'rock', count: 110, heightRange: [0.0, 1.0], maxSlope: 1.5, scale: [0.5, 2.6], clearRadius: 6 },
      { kind: 'birch', count: 30, heightRange: [0.05, 0.4], maxSlope: 0.4, scale: [0.7, 1.1], clearRadius: 14 },
    ],
    spawn: { x: 0, z: 10 },
  },
  glacemere: {
    id: 'glacemere', element: 'water', name: 'Glacemere Shores', subtitle: 'The Northern Reach', direction: 'north', seed: 3381,
    terrain: { size: S, segments: SEG, baseHeight: 3.5, hillAmplitude: 7, hillScale: 0.012, ridgeAmplitude: 9, rimHeight: 62, plateauRadius: 22, waterLevel: 2.6 },
    palette: { low: 0x9fc1c9, mid: 0xdfe9ef, high: 0xf6fbff, cliff: 0x7d8fa3, shore: 0xc9d6dc, water: 0x2f78b8, grass: 0xa8c6b8, foliage: [0x2f5e58, 0x3c7068, 0x4b8075], trunk: 0x4a3a35, rock: 0x8fa2b4, accent: 0x8fe3ff },
    atmosphere: { skyTop: 0x5f8fc8, skyHorizon: 0xe2edf5, cloud: 0xf4f8ff, cloudShadow: 0xa9b8cc, cloudCover: 0.55, sunElevation: 24, sunAzimuth: 120, sunColor: 0xe8f2ff, sunIntensity: 2.6, hemiSky: 0xd6ecff, hemiGround: 0x6f8aa0, fogColor: 0xdbe7f1, fogDensity: 0.0055, exposure: 0.9 },
    grassDensity: 0.45,
    props: [
      { kind: 'pine', count: 190, heightRange: [0.03, 0.7], maxSlope: 0.6, scale: [0.8, 1.7], clearRadius: 14 },
      { kind: 'crystal', count: 40, heightRange: [0.0, 0.9], maxSlope: 1, scale: [0.7, 1.8], clearRadius: 10 },
      { kind: 'rock', count: 90, heightRange: [0.0, 1.0], maxSlope: 1.5, scale: [0.5, 2.2], clearRadius: 6 },
    ],
    spawn: { x: 0, z: 10 },
  },
  galecrest: {
    id: 'galecrest', element: 'air', name: 'Galecrest Heights', subtitle: 'The Eastern Reach', direction: 'east', seed: 7745,
    terrain: { size: S, segments: SEG, baseHeight: 6, hillAmplitude: 12, hillScale: 0.009, ridgeAmplitude: 5, rimHeight: 50, plateauRadius: 26, waterLevel: 0.8 },
    palette: { low: 0x9ccf78, mid: 0xbfe08a, high: 0xe6edc8, cliff: 0x9a9a8a, shore: 0xe2dcb0, water: 0x5ab6d6, grass: 0xb5dc7a, foliage: [0xf2c6d8, 0xe8a8c4, 0xbfe08a], trunk: 0x7a6252, rock: 0xbab6a6, accent: 0xeafff9 },
    atmosphere: { skyTop: 0x2f8fe6, skyHorizon: 0xd8f0fb, cloud: 0xffffff, cloudShadow: 0xc4d6ea, cloudCover: 0.5, sunElevation: 52, sunAzimuth: 90, sunColor: 0xffffff, sunIntensity: 3.2, hemiSky: 0xd8f2ff, hemiGround: 0x8aa06a, fogColor: 0xd8eefa, fogDensity: 0.0032, exposure: 1.0 },
    grassDensity: 1.2,
    props: [
      { kind: 'birch', count: 110, heightRange: [0.05, 0.6], maxSlope: 0.45, scale: [0.9, 1.6], clearRadius: 14 },
      { kind: 'skyIsland', count: 14, heightRange: [0.0, 1.0], maxSlope: 99, scale: [0.7, 1.8], clearRadius: 70 },
      { kind: 'rock', count: 80, heightRange: [0.0, 1.0], maxSlope: 1.5, scale: [0.5, 2.0], clearRadius: 6 },
      { kind: 'pillar', count: 14, heightRange: [0.1, 0.6], maxSlope: 0.5, scale: [0.6, 1.2], clearRadius: 18 },
    ],
    spawn: { x: 0, z: 10 },
  },
};

export const regionOrder = ['emberreach', 'glacemere', 'thornwall', 'galecrest'] as const;
