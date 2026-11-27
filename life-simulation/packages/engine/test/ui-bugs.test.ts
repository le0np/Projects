import { describe, expect, it } from "vitest";
import type { Notice } from "@lifesim/core";
import { VirtualClock } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { Session, resolveConfig, runSession } from "../src";
import { buildContent, event, scripted } from "./helpers";

const duoChoices = [
  { id: "yes", label: "Yes", tags: ["help"] },
  { id: "no", label: "No", tags: ["refuse"], default: true },
];

describe("B2: the People list is up to date right after an event", () => {
  it("the resolved notice carries the relationships as they are after the event (strangers have met)", () => {
    const content = buildContent([event({ id: "duo", roles: { a: { count: 1 }, b: { count: 1 } }, choices: { a: duoChoices, b: duoChoices }, outcomes: [{ id: "done" }] })]);
    const notices: Notice[] = [];
    const c1 = scripted((v) => v.offer.choices[0]!.id);
    runSession({
      content,
      config: { seed: "b2", durationSeconds: 60, startingRelationships: { colleaguePairRatio: 0, familyChance: 0, partnerChance: 0 } },
      participants: [
        { career: "doctor", isBot: false, controller: c1 },
        { career: "teacher", isBot: true, controller: scripted((v) => v.offer.choices[0]!.id) },
      ],
      onNotice: (id, n) => id === "c1" && notices.push(n),
    });
    const offer = notices.find((n) => n.kind === "event") as Extract<Notice, { kind: "event" }>;
    expect(offer.view.others.find((o) => o.id === "c2")!.relation.type).toBe("stranger");
    const resolved = notices.find((n) => n.kind === "resolved") as Extract<Notice, { kind: "resolved" }>;
    expect(resolved.others?.find((o) => o.id === "c2")?.relation.type).toBe("acquaintance");
  });
});

describe("B4: players name their character", () => {
  it("uses the chosen name, and no bot gets the same name", () => {
    const content = loadContent();
    for (let k = 0; k < 30; k++) {
      // Every built-in name, in turn, chosen by the player.
      const chosen = ["Ana", "Ben", "Clara", "David", "Ema", "Filip", "Greta", "Hugo", "Ivana", "Jakob", "Kim", "Luka", "Maja", "Nikola", "Olga"][k % 15]!;
      const s = new Session(content, resolveConfig({ seed: `names-${k}` }), [
        { career: "doctor", isBot: false, name: chosen },
        ...Array.from({ length: 7 }, () => ({ career: "civilian", isBot: true })),
      ], new VirtualClock());
      s.start();
      const started = s.log[0] as Extract<(typeof s.log)[number], { type: "session_started" }>;
      expect(started.characters[0]!.name).toBe(chosen);
      const names = started.characters.map((c) => c.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("T4b N4: lists of names read naturally", () => {
  it("joins names with commas and a final 'and'", async () => {
    const { listNames } = await import("../src");
    expect(listNames([])).toBe("");
    expect(listNames(["Filip"])).toBe("Filip");
    expect(listNames(["Filip", "Clara"])).toBe("Filip and Clara");
    expect(listNames(["Filip", "Clara", "Ana", "Lana", "Maja"])).toBe("Filip, Clara, Ana, Lana and Maja");
  });

  it("is used in event texts (the finale names everyone)", () => {
    const content = loadContent();
    const texts: string[] = [];
    runSession({
      content,
      config: { seed: "n4" },
      participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career) => ({
        career,
        isBot: true,
        controller: scripted((v) => {
          texts.push(v.offer.publicText);
          return v.offer.choices[0]!.id;
        }, 500),
      })),
    });
    expect(texts.some((t) => / and [A-Z][a-z]+ and /.test(t))).toBe(false);
    expect(texts.some((t) => /[A-Z][a-z]+, [A-Z][a-z]+(, [A-Z][a-z]+)* and [A-Z][a-z]+/.test(t))).toBe(true);
  });
});
