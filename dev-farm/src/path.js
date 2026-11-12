// Shortest paths on the tile grid (4 directions).
// Without a cost function every step costs 1 (the farmer takes the shortest way);
// with one, cheaper tiles are preferred (customers stick to the road and paths).
import { W, H } from './world.js';

// Returns the tiles to walk through (excluding start, including the reached goal),
// [] if start already is a goal, or null if no goal is reachable.
export function findPath(start, goals, walkable, cost = () => 1) {
  const key = (x, y) => y * W + x;
  const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
  const [sx, sy] = start;
  const startKey = key(sx, sy);
  if (goalSet.has(startKey)) return [];

  const dist = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  dist[startKey] = 0;
  const heap = new MinHeap();
  heap.push(0, startKey);

  while (heap.size) {
    const [d, cur] = heap.pop();
    if (d > dist[cur]) continue;
    if (goalSet.has(cur)) {
      const path = [];
      for (let p = cur; p !== startKey; p = prev[p]) path.push([p % W, Math.floor(p / W)]);
      return path.reverse();
    }
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !walkable(nx, ny)) continue;
      const k = key(nx, ny);
      const nd = d + cost(nx, ny);
      if (nd < dist[k]) {
        dist[k] = nd;
        prev[k] = cur;
        heap.push(nd, k);
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.items = []; }

  get size() { return this.items.length; }

  push(priority, value) {
    const a = this.items;
    a.push([priority, value]);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
