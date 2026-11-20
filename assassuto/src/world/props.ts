import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PropKind } from '../config/regions';
import { Simplex2 } from './noise';

/** A prop is built from parts; each part becomes one InstancedMesh sharing the same transforms. */
export interface PropPart {
  geometry: THREE.BufferGeometry;
  /** Which palette entry colours this part. */
  colorKey: 'trunk' | 'foliage' | 'rock' | 'accent' | 'grass' | 'cliff';
  emissive?: boolean;
  flat?: boolean;
  wind?: number;
}

export interface PropTemplate {
  parts: PropPart[];
  /** Collider radius and height at scale 1 (0 = no collider). */
  colliderRadius: number;
  colliderHeight: number;
  /** Vertical offset range above the terrain (sky islands float). */
  floatHeight?: [number, number];
  sink?: number;
}

const noise = new Simplex2(77);

function displace(geo: THREE.BufferGeometry, amount: number, freq: number, seed = 0): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.noise(v.x * freq + seed, v.y * freq + v.z * freq * 0.7 - seed);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function blob(r: number, x: number, y: number, z: number, sy = 1, seed = 0): THREE.BufferGeometry {
  const g = displace(new THREE.IcosahedronGeometry(r, 2), 0.12, 1.4, seed);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return g;
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of clean) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const m = mergeGeometries(clean, false)!;
  m.computeVertexNormals();
  return m;
}

function trunk(height: number, r0: number, r1: number, lean = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, height, 7, 3);
  g.translate(0, height / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) + lean * (y / height) ** 2);
  }
  g.computeVertexNormals();
  return g;
}

export function buildPropTemplate(kind: PropKind): PropTemplate {
  switch (kind) {
    case 'oak':
      return {
        colliderRadius: 0.45, colliderHeight: 6,
        parts: [
          { geometry: trunk(3.6, 0.42, 0.26, 0.3), colorKey: 'trunk' },
          {
            geometry: merge([
              blob(2.1, 0.2, 4.6, 0, 0.85, 1), blob(1.6, -1.4, 4.0, 0.6, 0.8, 2),
              blob(1.5, 1.3, 4.1, -0.7, 0.8, 3), blob(1.3, 0.1, 5.7, -0.2, 0.8, 4),
            ]),
            colorKey: 'foliage', wind: 0.12,
          },
        ],
      };
    case 'pine': {
      const cones: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) {
        const c = new THREE.ConeGeometry(2.0 - i * 0.42, 2.4, 8, 1);
        c.translate(0, 2.4 + i * 1.35, 0);
        cones.push(displace(c, 0.06, 2, i));
      }
      return {
        colliderRadius: 0.35, colliderHeight: 6,
        parts: [
          { geometry: trunk(3.2, 0.32, 0.2), colorKey: 'trunk' },
          { geometry: merge(cones), colorKey: 'foliage', wind: 0.08 },
        ],
      };
    }
    case 'birch':
      return {
        colliderRadius: 0.25, colliderHeight: 6,
        parts: [
          { geometry: trunk(5, 0.22, 0.12, 0.5), colorKey: 'trunk' },
          {
            geometry: merge([blob(1.3, 0.4, 5.2, 0, 1.4, 5), blob(1.0, -0.5, 4.2, 0.4, 1.3, 6), blob(0.9, 0.6, 6.4, -0.2, 1.2, 7)]),
            colorKey: 'foliage', wind: 0.15,
          },
        ],
      };
    case 'rock': {
      const g = displace(new THREE.IcosahedronGeometry(1, 1), 0.28, 1.2, 3);
      g.scale(1.2, 0.75, 1);
      return { colliderRadius: 0.95, colliderHeight: 1.2, sink: 0.3, parts: [{ geometry: g, colorKey: 'rock', flat: true }] };
    }
    case 'spire': {
      const g = new THREE.CylinderGeometry(0.5, 1.6, 9, 6, 6);
      g.translate(0, 4.5, 0);
      displace(g, 0.12, 0.6, 9);
      return { colliderRadius: 1.3, colliderHeight: 9, sink: 0.5, parts: [{ geometry: g, colorKey: 'cliff', flat: true }] };
    }
    case 'crystal': {
      const shards: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) {
        const s = new THREE.OctahedronGeometry(0.5, 0);
        s.scale(0.55, 2.2 - i * 0.35, 0.55);
        s.rotateZ((i - 1.5) * 0.35);
        s.rotateY(i * 1.7);
        s.translate((i - 1.5) * 0.3, 1 - i * 0.12, (i % 2) * 0.3);
        shards.push(s);
      }
      return { colliderRadius: 0.6, colliderHeight: 2.4, sink: 0.2, parts: [{ geometry: merge(shards), colorKey: 'accent', emissive: true, flat: true }] };
    }
    case 'pillar': {
      const shaft = new THREE.CylinderGeometry(0.55, 0.62, 5, 10, 1);
      shaft.translate(0, 2.9, 0);
      const base = new THREE.BoxGeometry(1.6, 0.4, 1.6);
      base.translate(0, 0.2, 0);
      const cap = new THREE.BoxGeometry(1.5, 0.35, 1.5);
      cap.translate(0, 5.55, 0);
      return { colliderRadius: 0.75, colliderHeight: 5.8, parts: [{ geometry: merge([shaft, base, cap]), colorKey: 'rock', flat: true }] };
    }
    case 'skyIsland': {
      const under = displace(new THREE.ConeGeometry(6, 9, 9, 3), 0.15, 0.4, 11);
      under.rotateX(Math.PI);
      under.translate(0, -4.5, 0);
      const top = displace(new THREE.CylinderGeometry(6.2, 6, 0.8, 12, 1), 0.08, 0.5, 12);
      top.translate(0, 0.3, 0);
      return {
        colliderRadius: 0, colliderHeight: 0, floatHeight: [26, 60],
        parts: [
          { geometry: under, colorKey: 'cliff', flat: true },
          { geometry: top, colorKey: 'grass' },
        ],
      };
    }
  }
}
