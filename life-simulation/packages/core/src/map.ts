/**
 * The town (concept v2 §2): a tile grid with roads, places and their doors.
 * Pure data + path finding; content lives in packages/content/data/map.json.
 */
import { z } from "zod";
import { ID_PATTERN } from "./constants";

export const PLACE_KINDS = ["home", "office", "hospital", "cafe", "bar", "police", "shop", "garage", "school", "park"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/**
 * Where an event happens or where an effect sends someone:
 * a place kind, the home or workplace of a character, a street tile, or wherever the character is now.
 */
export const LOCATION_KINDS = [...PLACE_KINDS, "work", "street", "here"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

const Tile = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
export type TilePos = [number, number];

export const MapSchema = z.strictObject({
  width: z.number().int().min(8).max(64),
  height: z.number().int().min(8).max(64),
  roads: z.strictObject({ rows: z.array(z.number().int().min(0)), cols: z.array(z.number().int().min(0)) }),
  /** Tiles that are never walkable (trees, ponds). */
  blocked: z.array(Tile).default([]),
  places: z
    .array(
      z.strictObject({
        id: z.string().regex(ID_PATTERN),
        kind: z.enum(PLACE_KINDS),
        name: z.string().min(1),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().min(1),
        h: z.number().int().min(1),
        /** Walkable tile where people arrive (usually the road in front of the entrance). */
        door: Tile,
        /** Park-like places are walkable inside. */
        walkable: z.boolean().optional(),
      }),
    )
    .min(1),
});
export type MapData = z.infer<typeof MapSchema>;
export type Place = MapData["places"][number];

export class TownMap {
  readonly width: number;
  readonly height: number;
  readonly places: readonly Place[];
  private readonly walk: boolean[][];
  private readonly cache = new Map<string, TilePos[]>();

  constructor(readonly data: MapData) {
    this.width = data.width;
    this.height = data.height;
    this.places = data.places;
    this.walk = Array.from({ length: data.height }, () => Array<boolean>(data.width).fill(false));
    for (const r of data.roads.rows) for (let x = 0; x < data.width; x++) this.set(x, r, true);
    for (const c of data.roads.cols) for (let y = 0; y < data.height; y++) this.set(c, y, true);
    for (const p of data.places) {
      if (p.walkable) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) this.set(x, y, true);
    }
    for (const [x, y] of data.blocked) this.set(x, y, false);
  }

  private set(x: number, y: number, v: boolean): void {
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) (this.walk[y] as boolean[])[x] = v;
  }

  isWalkable(x: number, y: number): boolean {
    return this.walk[y]?.[x] ?? false;
  }

  place(id: string): Place | undefined {
    return this.places.find((p) => p.id === id);
  }

  placesOf(kind: PlaceKind): Place[] {
    return this.places.filter((p) => p.kind === kind);
  }

  /** Walkable road tiles (for street events). */
  streetTiles(): TilePos[] {
    const out: TilePos[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isWalkable(x, y) && (this.data.roads.rows.includes(y) || this.data.roads.cols.includes(x))) out.push([x, y]);
      }
    }
    return out;
  }

  /** Shortest 4-directional walk, excluding `from`, including `to`. Empty if unreachable or already there. */
  route(from: TilePos, to: TilePos): TilePos[] {
    if (from[0] === to[0] && from[1] === to[1]) return [];
    const key = `${from[0]},${from[1]}>${to[0]},${to[1]}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const idx = (x: number, y: number) => y * this.width + x;
    const prev = new Int32Array(this.width * this.height).fill(-2);
    prev[idx(from[0], from[1])] = -1;
    const queue: number[] = [idx(from[0], from[1])];
    const target = idx(to[0], to[1]);
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as number;
      if (cur === target) break;
      const x = cur % this.width;
      const y = Math.floor(cur / this.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        const n = idx(nx, ny);
        if (prev[n] !== -2) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    const path: TilePos[] = [];
    if (prev[target] === -2) return path;
    for (let cur = target; cur !== idx(from[0], from[1]); cur = prev[cur] as number) path.unshift([cur % this.width, Math.floor(cur / this.width)]);
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(key, path);
    return path;
  }

  /** Nearest place of a kind, by walking distance (ties by declaration order). */
  nearest(kind: PlaceKind, from: TilePos): Place | undefined {
    let best: Place | undefined;
    let bestLen = Infinity;
    for (const p of this.placesOf(kind)) {
      const len = this.route(from, p.door).length;
      if (len < bestLen) {
        best = p;
        bestLen = len;
      }
    }
    return best;
  }
}

export function manhattan(a: TilePos, b: TilePos): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}
