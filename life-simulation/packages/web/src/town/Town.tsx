import { useEffect, useRef, useState } from "react";
import type { Attribute, Notice } from "@lifesim/core";
import { api } from "../api";
import { ATTR_LABELS } from "../format";
import type { GameState, Walk } from "../useGame";
import { TILE, bubble, drawCharacter, drawMap, lookFor, nameTag, pulse, type MapData, type Season } from "./renderer";

const FPS = 8; // stepped, cut-out animation (concept v2 §7)

let mapCache: Promise<MapData> | null = null;
function loadMap(): Promise<MapData> {
  mapCache ??= api<MapData>("/api/map");
  return mapCache;
}

/** Tile position (fractional) and facing at session time t. */
function placeOf(walk: Walk | undefined, t: number): { x: number; y: number; dir: 1 | -1; moving: boolean } {
  if (!walk) return { x: 0, y: 0, dir: 1, moving: false };
  if (!walk.trip) return { x: walk.pos[0], y: walk.pos[1], dir: 1, moving: false };
  const { from, path, departAt, msPerTile } = walk.trip;
  const k = (t - departAt) / msPerTile;
  if (k <= 0) return { x: from[0], y: from[1], dir: 1, moving: false };
  if (k >= path.length) {
    const last = path[path.length - 1] ?? from;
    return { x: last[0], y: last[1], dir: 1, moving: false };
  }
  const i = Math.floor(k);
  const a = i === 0 ? from : (path[i - 1] as [number, number]);
  const b = path[i] as [number, number];
  const f = k - i;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, dir: b[0] < a[0] ? -1 : 1, moving: true };
}

/** The town's size in tiles once loaded (for placing things over the map). */
export function useMapSize(): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    loadMap().then((m) => setSize({ width: m.width, height: m.height }), () => setSize(null));
  }, []);
  return size;
}

interface Floater {
  text: string;
  good: boolean;
  wall: number;
}

export function Town({ game }: { game: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const floaters = useRef<Floater[]>([]);
  const seenNotices = useRef(new Set<string>());

  useEffect(() => {
    loadMap().then(setMap, () => setMap(null));
  }, []);

  // Changes to your own attributes float above your head for a moment.
  useEffect(() => {
    for (const n of game.history) {
      if (n.kind !== "resolved" && n.kind !== "upheaval") continue;
      const key = n.kind === "resolved" ? n.instanceId : `${n.id}-${n.t}`;
      if (seenNotices.current.has(key)) continue;
      seenNotices.current.add(key);
      if (seenNotices.current.size <= 1 && game.history.length > 5) continue; // do not replay old history on reconnect
      for (const [a, d] of Object.entries(n.selfChanges) as [Attribute, number][]) {
        floaters.current.push({ text: `${ATTR_LABELS[a].icon} ${d > 0 ? "+" : ""}${d}`, good: d > 0, wall: Date.now() });
      }
    }
  }, [game.history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = map.width * TILE * dpr;
    canvas.height = map.height * TILE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = () => getComputedStyle(document.documentElement).colorScheme.includes("dark");

    let raf = 0;
    let lastFrame = -1;
    // T5 (phones): the map zooms to where your event happens; this eases towards the target view.
    const view = { z: 1, cx: (map.width * TILE) / 2, cy: (map.height * TILE) / 2 };
    const render = (now: number) => {
      const frame = Math.floor((now / 1000) * FPS);
      if (frame === lastFrame && !reduce) {
        raf = requestAnimationFrame(render);
        return;
      }
      lastFrame = frame;
      const g = gameRef.current;
      const t = g.sync.sessionTime + (Date.now() - g.sync.wall) * g.timeScale;
      const season = (g.calendar?.season ?? "spring") as Season;
      const W = map.width * TILE;
      const H = map.height * TILE;
      const focus = g.pending?.tile ?? g.coming?.tile;
      const small = canvas.clientWidth > 0 && canvas.clientWidth < 520;
      const target = small && focus ? { z: 1.9, cx: focus[0] * TILE + TILE / 2, cy: focus[1] * TILE + TILE / 2 } : { z: 1, cx: W / 2, cy: H / 2 };
      const ease = reduce ? 1 : 0.35;
      view.z += (target.z - view.z) * ease;
      view.cx += (target.cx - view.cx) * ease;
      view.cy += (target.cy - view.cy) * ease;
      const tx = Math.min(0, Math.max(W - W * view.z, W / 2 - view.cx * view.z));
      const ty = Math.min(0, Math.max(H - H * view.z, H / 2 - view.cy * view.z));
      ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * tx, dpr * ty);
      drawMap(ctx, map, season, dark());

      // T5: places where something is happening pulse (yours strongly).
      const wallNow = Date.now();
      for (const f of g.feed) {
        if (f.kind === "event" && f.tile && t - f.t < 9000 && t >= f.t) pulse(ctx, f.tile, wallNow, false);
      }
      if (focus) pulse(ctx, focus, wallNow, true);

      // Who is in an event right now (shown with "!"): your pending offer, plus recent public events.
      const busy = new Set<string>();
      for (const p of g.pending?.participants ?? []) busy.add(p.characterId);
      for (const p of g.coming?.participants ?? []) busy.add(p.characterId);
      for (const f of g.feed) {
        if (f.kind === "event" && t - f.t < 9000 && t >= f.t) for (const p of f.participants) busy.add(p.characterId);
      }
      const age = Math.min(1, (g.calendar?.year ?? 0) / 40);
      const people = g.roster
        .map((r) => ({ r, at: placeOf(g.walks[r.characterId], t) }))
        .sort((a, b) => a.at.y - b.at.y);
      for (const { r, at } of people) {
        const other = g.others.find((o) => o.id === r.characterId);
        const mine = r.characterId === g.characterId;
        const gone = mine ? !!g.ended : !!other && other.status !== "active";
        const cx = at.x * TILE + TILE / 2;
        const ground = at.y * TILE + TILE - 4;
        const reaction = g.reactions[r.characterId];
        const reacting = reaction && reaction.until > wallNow ? reaction.reaction : undefined;
        const inEvent = busy.has(r.characterId) && !reacting;
        if (mine) {
          ctx.strokeStyle = "#2f6f62";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(cx, ground + 1, 13, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        drawCharacter(ctx, lookFor(r.characterId, r.career), cx, ground, 17, {
          frame: frame + r.characterId.length,
          dir: at.dir,
          walking: at.moving && !reduce,
          talking: inEvent && !at.moving && !reduce,
          reacting: false,
          ...(reacting && !gone ? { reaction: reacting } : {}),
          blink: (frame + r.characterId.charCodeAt(1)) % 23 === 0,
          age,
          gone,
        });
        nameTag(ctx, cx, ground - 33, r.name, mine);
        if (inEvent && !gone) bubble(ctx, cx + 16, ground - 33, "!", "#c2502f");
      }

      // Floating attribute changes above your own head.
      const me = people.find((p) => p.r.characterId === g.characterId);
      if (me) {
        floaters.current = floaters.current.filter((f) => Date.now() - f.wall < 2600);
        floaters.current.forEach((f, i) => {
          const age = (Date.now() - f.wall) / 2600;
          ctx.globalAlpha = 1 - age;
          ctx.font = "700 12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = f.good ? "#2c7a4b" : "#b23b3b";
          ctx.fillText(f.text, me.at.x * TILE + TILE / 2 + (i % 2 ? 18 : -18), me.at.y * TILE - 34 - age * 20 - i * 4);
          ctx.globalAlpha = 1;
        });
      }
      if (!reduce) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    const slow = reduce ? setInterval(() => render(performance.now()), 1000) : undefined;
    return () => {
      cancelAnimationFrame(raf);
      if (slow) clearInterval(slow);
    };
  }, [map]);

  if (!map) return <div className="town town-loading card">Loading the town…</div>;
  return <canvas ref={canvasRef} className="town" aria-label="The town seen from above, with everyone's characters" />;
}

export type { Notice };
