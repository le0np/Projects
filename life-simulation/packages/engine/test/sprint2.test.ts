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
