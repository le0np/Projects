// A tiny pixel-art toolkit: an RGBA buffer with shapes, lighting, dithering and outlines.
// No DOM here, so all art can be generated (and tested) in Node.

const colorCache = new Map();

export function rgba(c) {
  if (typeof c !== 'string') return c;
  let v = colorCache.get(c);
  if (!v) {
    const h = c.slice(1);
    v = [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255,
    ];
    colorCache.set(c, v);
  }
  return v;
}

export const shade = (c, k) => {
  const [r, g, b, a] = rgba(c);
  return [r * k, g * k, b * k, a];
};
export const withAlpha = (c, a) => {
  const [r, g, b] = rgba(c);
  return [r, g, b, Math.round(a * 255)];
};
export const mix = (c1, c2, t) => {
  const a = rgba(c1);
  const b = rgba(c2);
  return [0, 1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * t);
};

// 4×4 ordered dithering between the steps of a colour ramp (dark → light).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function pick(ramp, t, x = 0, y = 0) {
  const n = ramp.length;
  const f = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.floor(f);
  const th = (BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)] + 0.5) / 16;
  return ramp[Math.min(n - 1, i + (f - i > th ? 1 : 0))];
}

// Light comes from the top left, slightly towards the viewer.
const LIGHT = (() => {
  const v = [-0.5, -0.7, 0.55];
  const m = Math.hypot(...v);
  return v.map((a) => a / m);
})();

// Brightness (0..1) of a sphere at normalised position (nx, ny) inside a circle.
export function sphere(nx, ny) {
  const r2 = Math.min(1, nx * nx + ny * ny);
  const nz = Math.sqrt(1 - r2);
  return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
}

// --- deterministic randomness and noise

export function hash01(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash01(xi, yi, s);
  const b = hash01(xi + 1, yi, s);
  const c = hash01(xi, yi + 1, s);
  const d = hash01(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, s = 0, octaves = 3) {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * f, y * f, s + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// --- the pixel buffer

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, c) {
    if (c == null) return;
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const [r, g, b, a = 255] = rgba(c);
    const i = (y * this.w + x) * 4;
    const d = this.d;
    if (a >= 255) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  get(x, y) {
    if (!this.inside(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }

  alpha(x, y) {
    return this.inside(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0;
  }

  // c: colour, or fn(x, y) → colour | null
  rect(x0, y0, w, h, c) {
    for (let y = Math.floor(y0); y < y0 + h; y++) {
      for (let x = Math.floor(x0); x < x0 + w; x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  }

  // c: colour, or fn(nx, ny, x, y) → colour | null, with nx/ny in -1..1
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'function' ? c(nx, ny, x, y) : c);
      }
    }
  }

  line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.set(x, y, typeof c === 'function' ? c(Math.floor(x), Math.floor(y), i / n) : c);
    }
  }

  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.d[i + 3]) this.set(dx + x, dy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
      }
    }
  }

  // Selective outline: transparent pixels next to the sprite get a darker copy of their neighbour.
  outline(k = 0.42) {
    const out = new Uint8ClampedArray(this.d);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        let best = null;
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          if (this.alpha(x + dx, y + dy) > 200) {
            const c = this.get(x + dx, y + dy);
            if (!best || c[0] + c[1] + c[2] < best[0] + best[1] + best[2]) best = c;
          }
        }
        if (best) {
          const i = (y * this.w + x) * 4;
          out[i] = best[0] * k; out[i + 1] = best[1] * k; out[i + 2] = best[2] * k; out[i + 3] = 255;
        }
      }
    }
    this.d = out;
    return this;
  }

  count() {
    let n = 0;
    for (let i = 3; i < this.d.length; i += 4) if (this.d[i]) n++;
    return n;
  }
}
