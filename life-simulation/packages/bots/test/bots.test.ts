import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Rng, type CharacterView, type ChoiceTag, type Notice, type Perceived } from "@lifesim/core";
import { ARCHETYPES, BotController, BotMemory, createBotProfile, scoreChoices, type Archetype } from "../src";

function view(choices: { id: string; tags: ChoiceTag[]; perceived?: Perceived }[], opts: { otherAffinity?: number } = {}): CharacterView {
  return {
    now: 10_000,
    sessionProgress: 0.2,
    self: { id: "me", name: "Me", career: "civilian", attrs: { health: 70, mental: 70, money: 50, reputation: 50, career: 50 }, status: "active", facts: [] },
    others: [
      { id: "you", name: "You", career: "teacher", status: "active", relation: { type: "acquaintance", affinity: opts.otherAffinity ?? 0, trust: 50 } },
    ],
    offer: {
      instanceId: "E1",
      eventId: "test",
      title: "Test",
      category: "social",
      importance: "multi",
      offeredAt: 10_000,
      deadlineAt: 30_000,
      role: "a",
      participants: [
        { characterId: "me", name: "Me", role: "a" },
        { characterId: "you", name: "You", role: "b" },
      ],
      publicText: "",
      choices: choices.map((c, i) => ({ id: c.id, label: c.id, tags: c.tags, perceived: c.perceived ?? {}, special: false, isDefault: i === 0 })),
    },
  };
}

/** Share of `runs` decisions picking `choiceId` for bots of an archetype (fresh profile per run). */
function share(archetype: Archetype, v: CharacterView, choiceId: string, runs = 300): number {
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const rng = new Rng(`${archetype}-${i}`);
    const bot = new BotController(createBotProfile(rng.fork("p"), archetype), rng.fork("d"));
    if (bot.decide(v)!.choiceId === choiceId) hits++;
  }
  return hits / runs;
}

const truthOrLie = view([
  { id: "lie", tags: ["lie"], perceived: { benefit: 1 } },
  { id: "truth", tags: ["truth"], perceived: { reputation: 1 } },
]);
const helpOrRefuse = view([
  { id: "refuse", tags: ["refuse"] },
  { id: "help", tags: ["help", "sacrifice"], perceived: { money: -1, relation: { b: 2 } } },
]);
const riskyOrSafe = view([
  { id: "safe", tags: ["ignore"], perceived: { risk: 0 } },
  { id: "risky", tags: ["risk"], perceived: { risk: 2, career: 2 } },
]);

describe("personality profiles", () => {
  it("are deterministic per seed and unique per bot", () => {
    expect(createBotProfile(new Rng("x"), "naive")).toEqual(createBotProfile(new Rng("x"), "naive"));
    const profiles = Array.from({ length: 20 }, (_, i) => JSON.stringify(createBotProfile(new Rng(`u${i}`), "altruist").personality));
    expect(new Set(profiles).size).toBe(20);
  });

  it("follow archetype means, with motives of the archetype", () => {
    const mean = (a: Archetype, trait: "empathy" | "honesty") =>
      Array.from({ length: 100 }, (_, i) => createBotProfile(new Rng(`${a}${i}`), a).personality[trait]).reduce((s, v) => s + v, 0) / 100;
    expect(mean("altruist", "empathy")).toBeGreaterThan(75);
    expect(mean("manipulator", "honesty")).toBeLessThan(25);
    const p = createBotProfile(new Rng("m"), "cautious");
    expect(p.motives.length).toBeGreaterThanOrEqual(1);
    for (const m of p.motives) expect(["avoid_responsibility", "protect_finances"]).toContain(m.type);
  });
});

describe("decisions are personality-driven", () => {
  it("principled bots tell the truth far more often than manipulators", () => {
    expect(share("principled", truthOrLie, "truth")).toBeGreaterThan(0.8);
    expect(share("manipulator", truthOrLie, "truth")).toBeLessThan(0.3);
  });

  it("altruists help more than opportunists", () => {
    expect(share("altruist", helpOrRefuse, "help")).toBeGreaterThan(share("opportunist", helpOrRefuse, "help") + 0.3);
  });

  it("impulsive bots take risks more than cautious bots", () => {
    expect(share("impulsive", riskyOrSafe, "risky")).toBeGreaterThan(share("cautious", riskyOrSafe, "risky") + 0.3);
  });

  it("no archetype always picks the same choice", () => {
    for (const a of ARCHETYPES) {
      const picks = new Set<string>();
      for (const v of [truthOrLie, helpOrRefuse, riskyOrSafe]) {
        for (let i = 0; i < 100; i++) {
          const rng = new Rng(`${a}-var-${i}`);
          picks.add(`${v.offer.choices[0]!.id}:${new BotController(createBotProfile(rng.fork("p"), a), rng.fork("d")).decide(v)!.choiceId}`);
        }
      }
      expect(picks.size, a).toBeGreaterThanOrEqual(4); // at least one of the dilemmas goes both ways
    }
  });

  it("caring about someone changes how a choice affecting them scores", () => {
    const profile = createBotProfile(new Rng("care"), "altruist");
    const util = (affinity: number) =>
      scoreChoices(
        view([{ id: "x", tags: ["ignore"] }, { id: "hurt", tags: ["ignore"], perceived: { relation: { b: -2 } } }], { otherAffinity: affinity }),
        profile,
        new BotMemory(),
      )[1]!.utility;
    expect(util(80)).toBeLessThan(util(-80));
  });

  it("thinks within the deadline", () => {
    for (let i = 0; i < 50; i++) {
      const rng = new Rng(`t${i}`);
      const d = new BotController(createBotProfile(rng.fork("p")), rng.fork("d")).decide(truthOrLie)!;
      expect(d.thinkMs).toBeGreaterThan(0);
      expect(d.thinkMs).toBeLessThan(20_000 * 0.9 + 1);
    }
  });
});

describe("session memory", () => {
  const resolved = (revealed: { id: string; tags: ChoiceTag[] }[], selfChanges = {}): Notice => ({
    kind: "resolved",
    t: 20_000,
    instanceId: "E1",
    eventId: "test",
    title: "Test",
    role: "a",
    participants: [
      { characterId: "me", name: "Me", role: "a" },
      { characterId: "you", name: "You", role: "b" },
    ],
    revealed: revealed.map((r) => ({ characterId: r.id, role: "b", choiceId: "x", label: "x", tags: r.tags })),
    selfChanges,
  });

  it("remembers help and betrayal", () => {
    const m = new BotMemory();
    m.observe(resolved([{ id: "you", tags: ["help"] }]), "me");
    expect(m.feelingAbout("you")).toBeGreaterThan(0);
    m.observe(resolved([{ id: "you", tags: ["lie"] }]), "me");
    m.observe(resolved([{ id: "you", tags: ["threaten"] }]), "me");
    expect(m.feelingAbout("you")).toBeLessThan(0);
    expect(m.encountersWith("you")).toBe(3);
    expect(m.entries.filter((e) => e.kind === "betrayed_me")).toHaveLength(1);
  });

  it("suspects co-participants after an unexplained loss", () => {
    const m = new BotMemory();
    m.observe(resolved([], { career: -15 }), "me");
    expect(m.feelingAbout("you")).toBeLessThan(0);
  });

  it("grudges can turn aggressive bots towards revenge", () => {
    const rng = new Rng("rev");
    const profile = createBotProfile(rng.fork("p"), "authoritarian");
    profile.personality.aggression = 90;
    profile.motives = [];
    const bot = new BotController(profile, rng.fork("d"));
    bot.decide(truthOrLie); // learns its own id
    for (let i = 0; i < 3; i++) bot.observe(resolved([{ id: "you", tags: ["threaten"] }]));
    expect(profile.motives).toContainEqual(expect.objectContaining({ type: "revenge", targetId: "you" }));
  });
});

describe("fairness", () => {
  it("the bot package depends only on @lifesim/core", () => {
    const dir = join(__dirname, "../src");
    for (const file of readdirSync(dir)) {
      const src = readFileSync(join(dir, file), "utf8");
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
      for (const imp of imports) expect(imp === "@lifesim/core" || imp.startsWith("./"), `${file} imports ${imp}`).toBe(true);
    }
  });
});
