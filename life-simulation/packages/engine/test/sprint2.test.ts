import { describe, expect, it } from "vitest";
import { Rng, VirtualClock, type Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { RandomController, Session, resolveConfig, runSession } from "../src";

const content = loadContent();
const clock = new VirtualClock();

function play(seed: string) {
  const notices: { id: string; n: Notice }[] = [];
  const result = runSession({
    content,
    config: { seed },
    participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career, i) => ({
      career,
      isBot: true,
      controller: new RandomController(new Rng(`${seed}-${i}`), 0),
    })),
    onNotice: (id, n) => notices.push({ id, n }),
  });
  return { notices, result };
}

describe("T5: the event begins on the map", () => {
  it("announces an event while people walk there, at the tile where the card will open", () => {
    const { notices } = play("t5");
    const coming = notices.filter((x) => x.n.kind === "coming") as { id: string; n: Extract<Notice, { kind: "coming" }> }[];
    expect(coming.length).toBeGreaterThan(10);
    for (const c of coming.slice(0, 30)) {
      const offer = notices.find((x) => x.id === c.id && x.n.kind === "event" && x.n.view.offer.instanceId === c.n.instanceId);
      if (!offer || offer.n.kind !== "event") continue; // the session may have ended
      expect(offer.n.t).toBe(c.n.offerAt);
      expect(offer.n.t).toBeGreaterThan(c.n.t);
      expect(offer.n.view.offer.tile).toEqual(c.n.tile);
      expect(c.n.participants.map((p) => p.characterId)).toContain(c.id);
    }
  });

  it("the outcome tells who decided (cards turned over together) and how everyone reacts", () => {
    const { notices } = play("t5b");
    const shared = notices.filter((x) => x.n.kind === "resolved" && (x.n.deciders?.length ?? 0) >= 2) as { id: string; n: Extract<Notice, { kind: "resolved" }> }[];
    expect(shared.length).toBeGreaterThan(5);
    const reactions = new Set<string>();
    for (const { n } of shared) {
      const visible = n.participants.map((p) => p.characterId);
      for (const d of n.deciders!) expect(visible).toContain(d);
      expect(n.reactions!.map((r) => r.characterId).sort()).toEqual([...visible].sort());
      for (const r of n.reactions!) reactions.add(r.reaction);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(3);
  });

  it("public events carry their tile (the place pulses for everyone)", () => {
    const session = new Session(content, resolveConfig({ seed: "t5c" }), ["doctor", "teacher", "mechanic"].map((career) => ({ career, isBot: true })), clock);
    const tiles: [number, number][] = [];
    session.onPublic = (e) => e.kind === "event" && tiles.push(e.tile);
    session.start();
    for (let i = 0; i < 200 && tiles.length < 3; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    expect(tiles.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of tiles) expect(content.map.isWalkable(x, y) || content.map.places.some((p) => p.door[0] === x && p.door[1] === y)).toBe(true);
  });

});

describe("T6: moods and ties on the map", () => {
  it("moods change after events and are published; everyone has one at any time", () => {
    // Nobody answers: every event resolves with its defaults, which still changes people's moods.
    const clock = new VirtualClock();
    const session = new Session(content, resolveConfig({ seed: "t6" }), ["doctor", "teacher", "mechanic", "civilian"].map((career) => ({ career, isBot: true })), clock);
    const moods: string[] = [];
    session.onPublic = (e) => e.kind === "mood" && moods.push(e.mood);
    session.start();
    for (let i = 0; i < 3000 && session.state === "active"; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    expect(moods.length).toBeGreaterThan(5);
    expect(new Set(moods).size).toBeGreaterThanOrEqual(3);
    expect(session.moods()).toHaveLength(4);
  });

  it("debts show up as a tie between the two characters (both ways)", () => {
    let ties: { viewer: string; other: string; debt: string | undefined }[] = [];
    for (let k = 0; k < 20 && ties.length === 0; k++) {
      const { notices } = play(`t6-debt-${k}`);
      ties = notices.flatMap((x) => (x.n.kind === "resolved" ? (x.n.others ?? []).filter((o) => o.debt).map((o) => ({ viewer: x.id, other: o.id, debt: o.debt })) : []));
    }
    expect(ties.length).toBeGreaterThan(0);
    // If A sees "you_owe" B, then B (at some point) sees "owes_you" A.
    const t = ties.find((x) => x.debt === "you_owe");
    if (t) expect(ties.some((x) => x.viewer === t.other && x.other === t.viewer && (x.debt === "owes_you" || x.debt === "both"))).toBe(true);
  });
});

describe("T5b R2: people stay at the spot while the cards are revealed", () => {
  it("after an event with a human, nobody in it walks away for the linger time (live pacing only)", async () => {
    const { humanPacing } = await import("../src");
    const pacing = humanPacing(6);
    const result = runSession({
      content,
      config: { seed: "linger", humanPacing: pacing },
      participants: [
        { career: "lawyer", isBot: false, controller: { decide: (v) => ({ choiceId: v.offer.choices[0]!.id, thinkMs: 3000 * 6 }) } },
        ...["doctor", "teacher", "mechanic", "civilian"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`l${i}`), 0) })),
      ],
    });
    const linger = pacing.lingerSeconds * 1000 * 6;
    const started = new Map<string, string[]>();
    let checked = 0;
    for (const e of result.log) {
      if (e.type === "event_started") started.set(e.instanceId, Object.values(e.bindings).flat());
      if (e.type !== "event_resolved") continue;
      const who = started.get(e.instanceId)!;
      if (!who.includes("c1")) continue;
      const early = result.log.filter((m) => m.type === "moved" && who.includes(m.characterId) && m.t > e.t && m.t < e.t + linger && m.reason !== "event");
      expect(early).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
});

describe("T7: lasting traces on the map", () => {
  it("a mark effect puts a trace at the person's home, and it goes away after its time", async () => {
    const { buildContent, event } = await import("./helpers");
    const bundle = buildContent([
      event({
        id: "sale",
        cooldown: { maxPerSession: 1 },
        roles: { a: { count: 1 } },
        choices: { a: [{ id: "ok", label: "OK", tags: ["help"] }, { id: "no", label: "No", tags: ["refuse"], default: true }] },
        outcomes: [{ id: "done", effects: [{ type: "mark", target: "role:a", mark: "for_sale", seconds: 20 }, { type: "mark", target: "role:a", mark: "bandage" }] }],
      }),
    ]);
    const clock = new VirtualClock();
    const session = new Session(bundle, resolveConfig({ seed: "marks", durationSeconds: 120 }), [{ career: "civilian", isBot: true }], clock);
    const entries: { kind: string; t: number; mark?: { kind: string; placeId: string | null; until?: number } }[] = [];
    session.onPublic = (e) => (e.kind === "mark" || e.kind === "unmark") && entries.push(e as never);
    session.start();
    const home = (session.log[0] as { characters: { home: string }[] }).characters[0]!.home;
    for (let i = 0; i < 2000 && session.state === "active"; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    const sale = entries.find((e) => e.kind === "mark" && e.mark!.kind === "for_sale")!;
    expect(sale.mark!.placeId).toBe(home);
    expect(sale.mark!.until! - sale.t).toBe(20_000);
    expect(entries.some((e) => e.kind === "unmark" && e.t === sale.mark!.until)).toBe(true);
    const bandage = entries.find((e) => e.kind === "mark" && e.mark!.kind === "bandage")!;
    expect(bandage.mark!.placeId).toBeNull();
    expect(session.currentMarks().map((m) => m.kind)).toEqual(["bandage"]); // no end time: stays
  });

  it("death leaves flowers at home; at least 6 kinds of traces appear across sessions", () => {
    const kinds = new Set<string>();
    let deaths = 0;
    for (let k = 0; k < 40; k++) {
      runSession({
        content,
        config: { seed: `traces-${k}` },
        participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`tr${k}-${i}`), 0) })),
        mischief: [{ t: 60_000, characterId: "c1", mischiefId: "flat_tyres", targetId: "c2" }],
        onPublic: (e) => {
          if (e.kind === "mark") kinds.add(e.mark.kind);
          if (e.kind === "ended" && e.status === "dead") deaths++;
        },
      });
    }
    if (deaths > 0) expect(kinds.has("flowers")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });
});
