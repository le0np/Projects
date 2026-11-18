/**
 * Canvas drawing for the town diorama (concept v2): the map in four seasons and the
 * B3 "cardboard puppet" characters approved by the owner (docs/sketches/characters-b3.html).
 * Pure drawing functions; the Town component decides what to draw where.
 */

export const TILE = 32;

export interface MapData {
  width: number;
  height: number;
  roads: { rows: number[]; cols: number[] };
  blocked: [number, number][];
  places: { id: string; kind: string; name: string; x: number; y: number; w: number; h: number; door: [number, number]; walkable?: boolean }[];
}

export type Season = "spring" | "summer" | "autumn" | "winter";

const ROOF: Record<string, string> = {
  home: "#c97b5a",
  office: "#5b7896",
  hospital: "#e9eef0",
  cafe: "#b98a4a",
  bar: "#7a4d7a",
  police: "#3d5a9c",
  shop: "#d0a63c",
  garage: "#7b8070",
  school: "#c25f4b",
  park: "#6f9e5a",
};
const ICON: Record<string, string> = { home: "⌂", office: "▦", hospital: "✚", cafe: "☕", bar: "♪", police: "★", shop: "€", garage: "⚙", school: "✎", park: "✿" };

const SEASON_COLORS: Record<Season, { grass: [string, string]; park: string; tree: string; road: string; accent?: string }> = {
  spring: { grass: ["#cfe3bf", "#c6dcb5"], park: "#b7d9a1", tree: "#6aa95a", road: "#ddd6c9", accent: "#f2a7c3" },
  summer: { grass: ["#c3dca6", "#b9d49b"], park: "#a9d08c", tree: "#4e9447", road: "#e0d8c8" },
  autumn: { grass: ["#d9d1a6", "#d1c899"], park: "#cdbd7c", tree: "#d47f2f", road: "#dcd3c3", accent: "#e8a33d" },
  winter: { grass: ["#eef2f5", "#e6ecf0"], park: "#e1e8ec", tree: "#7f9a8c", road: "#c9cdd2", accent: "#ffffff" },
};

/** Deterministic pseudo-random from a string (stable decorations and looks). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function drawMap(ctx: CanvasRenderingContext2D, map: MapData, season: Season, dark: boolean): void {
  const c = SEASON_COLORS[season];
  const W = map.width * TILE;
  const H = map.height * TILE;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = c.grass[(x + y) % 2] as string;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  for (const p of map.places.filter((p) => p.walkable)) {
    ctx.fillStyle = c.park;
    ctx.fillRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE);
  }
  ctx.fillStyle = c.road;
  for (const r of map.roads.rows) ctx.fillRect(0, r * TILE, W, TILE);
  for (const col of map.roads.cols) ctx.fillRect(col * TILE, 0, TILE, H);
  ctx.strokeStyle = season === "winter" ? "#f8fafb" : "#f5f1e8";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  for (const r of map.roads.rows) line(ctx, 0, r * TILE + 16, W, r * TILE + 16);
  for (const col of map.roads.cols) line(ctx, col * TILE + 16, 0, col * TILE + 16, H);
  ctx.setLineDash([]);

  // Seasonal ground details (stable per tile).
  if (c.accent) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const h = hash(`${x},${y}`);
        if (h % 7 !== 0 || map.roads.rows.includes(y) || map.roads.cols.includes(x)) continue;
        ctx.fillStyle = c.accent;
        const px = x * TILE + (h % 23) + 4;
        const py = y * TILE + ((h >> 5) % 23) + 4;
        if (season === "winter") ctx.fillRect(px, py, 3, 3);
        else ctx.beginPath(), ctx.arc(px, py, 2.4, 0, Math.PI * 2), ctx.fill();
      }
    }
  }

  for (const [x, y] of map.blocked) {
    ctx.fillStyle = "rgba(0,0,0,.18)";
    circle(ctx, x * TILE + 18, y * TILE + 19, 12);
    ctx.fillStyle = c.tree;
    circle(ctx, x * TILE + 16, y * TILE + 16, 12);
    if (season === "spring") {
      ctx.fillStyle = "#f6b9cf";
      for (const [dx, dy] of [[-5, -4], [4, -6], [6, 3], [-3, 5]] as const) circle(ctx, x * TILE + 16 + dx, y * TILE + 16 + dy, 2.2);
    }
    if (season === "winter") {
      ctx.fillStyle = "#ffffff";
      circle(ctx, x * TILE + 13, y * TILE + 11, 6);
    }
  }

  for (const p of map.places) {
    if (p.walkable) continue;
    const X = p.x * TILE + 3;
    const Y = p.y * TILE + 3;
    const w = p.w * TILE - 6;
    const h = p.h * TILE - 6;
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.fillRect(X + 4, Y + 5, w, h);
    ctx.fillStyle = ROOF[p.kind] ?? "#999";
    ctx.fillRect(X, Y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(X, Y, w, h / 2);
    if (season === "winter") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(X, Y, w, 6);
    }
    if (dark) {
      ctx.fillStyle = "#ffd86b";
      for (let i = 0; i < p.w; i++) if ((i * 7 + p.x) % 3 !== 0) ctx.fillRect(X + 8 + i * TILE * 0.9, Y + h - 9, 6, 4);
    }
    ctx.fillStyle = p.kind === "hospital" ? "#c0392b" : "rgba(255,255,255,.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(ICON[p.kind] ?? "", X + w / 2, Y + h / 2 - (p.kind === "home" ? 0 : 7));
    if (p.kind !== "home") {
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.fillText(p.name.toUpperCase(), X + w / 2, Y + h / 2 + 9, w - 6);
    }
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function stroke(ctx: CanvasRenderingContext2D, pts: [number, number][], col: string, w: number): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

// ------------------------------------------------------------------ characters (style B3)

export interface Look {
  skin: string;
  hair: string;
  hairStyle: "short" | "bob" | "spiky";
  cloth: string;
  extra: "coat" | "cap" | "overalls" | "tie" | "hardhat" | "glasses" | "none";
}

const SKINS = ["#f2c9a5", "#e8b48f", "#d9a07a", "#b97c55", "#8d5a3b", "#f5d6bd"];
const HAIRS = ["#2a2a2a", "#5a3a22", "#b5522b", "#d9b46a", "#1c1410", "#7a4a2a"];
const CAREER_LOOK: Record<string, Pick<Look, "cloth" | "extra">> = {
  doctor: { cloth: "#ffffff", extra: "coat" },
  police_officer: { cloth: "#3c5aa6", extra: "cap" },
  mechanic: { cloth: "#e07b39", extra: "overalls" },
  lawyer: { cloth: "#f4f1ea", extra: "tie" },
  engineer: { cloth: "#4b8bbe", extra: "hardhat" },
  teacher: { cloth: "#5f8f5a", extra: "glasses" },
  psychologist: { cloth: "#8a6bb8", extra: "glasses" },
  journalist: { cloth: "#c9a46a", extra: "none" },
  entrepreneur: { cloth: "#2f3640", extra: "tie" },
  civilian: { cloth: "#d9534f", extra: "none" },
};

/** Stable look for a character: career decides the clothes, the id decides skin and hair. */
export function lookFor(characterId: string, career: string): Look {
  const h = hash(`${characterId}:${career}`);
  return {
    skin: SKINS[h % SKINS.length] as string,
    hair: HAIRS[(h >> 3) % HAIRS.length] as string,
    hairStyle: (["short", "bob", "spiky"] as const)[(h >> 7) % 3] as Look["hairStyle"],
    ...(CAREER_LOOK[career] ?? { cloth: "#888888", extra: "none" }),
  };
}

export interface Pose {
  frame: number;
  dir: 1 | -1;
  walking: boolean;
  talking: boolean;
  reacting: boolean;
  blink: boolean;
  /** 0 young … 1 old. */
  age: number;
  gone: boolean;
}

const INK = "#3a2a22";

function hairColor(look: Look, age: number): string {
  return age < 0.45 ? look.hair : age < 0.75 ? "#8e8a84" : "#d9d6d0";
}

/** B3 face: dashes or arcs for eyes, thick moving brows, a big mouth. */
function face(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pose: Pose, look: Look): void {
  const gap = s * 0.26;
  const hc = hairColor(look, pose.age);
  const browCol = hc === "#d9d6d0" ? "#9a958d" : hc;
  const browY = pose.reacting ? y - s * 0.3 : pose.talking && pose.frame % 2 ? y - s * 0.24 : y - s * 0.18;
  stroke(ctx, [[x - gap - s * 0.12, browY + s * 0.03], [x - gap + s * 0.1, browY]], browCol, s * 0.07);
  stroke(ctx, [[x + gap - s * 0.1, browY], [x + gap + s * 0.12, browY + s * 0.03]], browCol, s * 0.07);
  if (pose.gone) {
    for (const ex of [x - gap, x + gap]) {
      stroke(ctx, [[ex - s * 0.06, y - s * 0.06], [ex + s * 0.06, y + s * 0.06]], INK, 2);
      stroke(ctx, [[ex + s * 0.06, y - s * 0.06], [ex - s * 0.06, y + s * 0.06]], INK, 2);
    }
    stroke(ctx, [[x - s * 0.15, y + s * 0.26], [x + s * 0.15, y + s * 0.26]], INK, 2);
    return;
  }
  if (pose.reacting) {
    stroke(ctx, [[x - gap - s * 0.07, y - s * 0.05], [x - gap + s * 0.05, y], [x - gap - s * 0.07, y + s * 0.05]], INK, 2.5);
    stroke(ctx, [[x + gap + s * 0.07, y - s * 0.05], [x + gap - s * 0.05, y], [x + gap + s * 0.07, y + s * 0.05]], INK, 2.5);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y + s * 0.18);
    ctx.quadraticCurveTo(x, y + s * 0.6, x + s * 0.3, y + s * 0.18);
    ctx.closePath();
    ctx.fillStyle = "#6b2a1f";
    ctx.fill();
    return;
  }
  const smile = pose.blink ? 0 : s * 0.04;
  stroke(ctx, [[x - gap - s * 0.07, y + smile], [x - gap, y - smile], [x - gap + s * 0.07, y + smile]], INK, 2.5);
  stroke(ctx, [[x + gap - s * 0.07, y + smile], [x + gap, y - smile], [x + gap + s * 0.07, y + smile]], INK, 2.5);
  if (look.extra === "glasses") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    for (const ex of [x - gap, x + gap]) {
      ctx.beginPath();
      ctx.arc(ex, y, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (pose.talking && pose.frame % 2 === 0) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y + s * 0.2);
    ctx.quadraticCurveTo(x, y + s * 0.48, x + s * 0.22, y + s * 0.2);
    ctx.closePath();
    ctx.fillStyle = "#6b2a1f";
    ctx.fill();
  } else stroke(ctx, [[x - s * 0.22, y + s * 0.22], [x, y + s * 0.3], [x + s * 0.22, y + s * 0.22]], INK, 2.5);
  if (pose.age > 0.55) stroke(ctx, [[x - s * 0.3, y + s * 0.16], [x - s * 0.26, y + s * 0.26]], shade(look.skin, 0.75), 1.5);
}

/** The bean puppet. (x, ground) is the point between the feet; s is the size unit. */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, x: number, ground: number, s: number, pose: Pose): void {
  const hop = pose.walking ? (pose.frame % 2 ? -s * 0.22 : 0) : 0;
  const jump = pose.reacting ? -s * 0.45 : 0;
  const squash = pose.walking && pose.frame % 2 === 0 ? 1.05 : 1;
  const w = s * 0.62;
  const h = s * 1.7;
  const outline = shade(look.extra === "coat" ? look.skin : look.cloth, 0.55);
  ctx.save();
  ctx.globalAlpha = pose.gone ? 0.55 : 1;
  oval(ctx, x + 3, ground + 2, s * 0.6 * (hop ? 0.8 : 1), s * 0.13, "rgba(0,0,0,.22)");
  ctx.translate(x, ground + hop + jump);
  ctx.scale(squash, 1 / squash);
  ctx.rotate(pose.dir * pose.age * 0.1);
  const step = pose.walking ? (pose.frame % 2 ? 2 : -2) : 0;
  oval(ctx, -s * 0.25 + step, -1, s * 0.16, s * 0.08, "#4a3b33");
  oval(ctx, s * 0.25 - step, -1, s * 0.16, s * 0.08, "#4a3b33");
  const body = () => {
    ctx.beginPath();
    ctx.roundRect(-w, -h, w * 2, h - s * 0.05, [w, w, w * 0.5, w * 0.5]);
  };
  ctx.save();
  ctx.translate(3, 3);
  body();
  ctx.fillStyle = "rgba(0,0,0,.14)";
  ctx.fill();
  ctx.restore();
  body();
  ctx.fillStyle = look.skin;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = look.extra === "overalls" ? "#3d6e9e" : look.cloth;
  ctx.fillRect(-w, -h * 0.45, w * 2, h * 0.45);
  if (look.extra === "coat") {
    ctx.fillStyle = "#9ec6d6";
    ctx.fillRect(-s * 0.04, -h * 0.45, s * 0.08, h * 0.45);
  }
  if (look.extra === "tie") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -h * 0.45);
    ctx.lineTo(s * 0.06, -h * 0.45);
    ctx.lineTo(s * 0.09, -h * 0.15);
    ctx.lineTo(0, -h * 0.08);
    ctx.lineTo(-s * 0.09, -h * 0.15);
    ctx.closePath();
    ctx.fillStyle = "#b0302a";
    ctx.fill();
  }
  ctx.fillStyle = hairColor(look, pose.age);
  if (look.extra === "cap") {
    ctx.fillStyle = "#24366b";
    ctx.fillRect(-w, -h, w * 2, h * 0.22);
  } else if (look.extra === "hardhat") {
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(-w, -h, w * 2, h * 0.2);
  } else if (look.hairStyle === "spiky") {
    ctx.beginPath();
    ctx.moveTo(-w, -h * 0.76);
    ctx.lineTo(-w * 0.6, -h - 6);
    ctx.lineTo(-w * 0.2, -h * 0.82);
    ctx.lineTo(w * 0.2, -h - 8);
    ctx.lineTo(w * 0.6, -h * 0.82);
    ctx.lineTo(w, -h * 0.76);
    ctx.lineTo(w, -h);
    ctx.lineTo(-w, -h);
    ctx.fill();
  } else ctx.fillRect(-w, -h, w * 2, h * (look.hairStyle === "bob" ? 0.28 : 0.18));
  ctx.restore();
  body();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
  ctx.stroke();
  if (look.extra === "cap") {
    ctx.beginPath();
    ctx.roundRect(pose.dir > 0 ? 0 : -w - s * 0.25, -h * 0.79, w + s * 0.25, s * 0.1, 3);
    ctx.fillStyle = "#1a2850";
    ctx.fill();
  }
  const armUp = pose.reacting ? -s * 0.7 : pose.talking && pose.frame % 2 ? -s * 0.35 : pose.walking ? (pose.frame % 2 ? -s * 0.1 : s * 0.1) : 0;
  for (const side of [-1, 1] as const) {
    stroke(ctx, [[side * w, -h * 0.35], [side * (w + s * 0.32), -h * 0.2 + armUp * (side === pose.dir ? 1 : 0.6)]], outline, 2.5);
  }
  face(ctx, 0, -h * 0.58, s * 0.62, pose, look);
  ctx.restore();
}

/** Speech/emote bubble above a character. */
export function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, accent: string): void {
  ctx.font = "700 11px system-ui, sans-serif";
  const w = Math.max(16, ctx.measureText(text).width + 10);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 16, w, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 8);
}

export function nameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, mine: boolean): void {
  ctx.font = "600 10px system-ui, sans-serif";
  const w = ctx.measureText(name).width + 8;
  ctx.fillStyle = mine ? "#2f6f62" : "rgba(255,255,255,.88)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 12, w, 13, 4);
  ctx.fill();
  ctx.fillStyle = mine ? "#ffffff" : "#1f2328";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x, y - 5.5);
}
