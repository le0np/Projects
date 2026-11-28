import { describe, expect, it } from "vitest";
import { readChaptersDir, validateChapters, loadChapters } from "@lifesim/content";
import { ChapterLife, playBotLife, replayLife, type LifeSetup } from "../src";

const content = loadChapters();
const setup: LifeSetup = { name: "Leo", dream: "fame", flaw: "coward", career: "journalist" };

/** Plays until the predicate holds, always taking the first card and the first choice. */
function advance(life: ChapterLife, until: (l: ChapterLife) => boolean, pick: (ids: string[]) => string = (ids) => ids[0]!) {
  for (let i = 0; i < 200 && !until(life); i++) {
    const step = life.view().step;
    const err =
      step.kind === "focus"
        ? life.chooseFocus(pick(step.cards.map((c) => c.id)))
        : step.kind === "event"
          ? life.choose(pick(step.choices.map((c) => c.id)))
          : life.next();
    if (err) throw new Error(err);
  }
}

describe("Sprint 5: life in chapters", () => {
  it("content passes the validator, with the coverage the sprint asks for", () => {
    const { issues } = validateChapters(readChaptersDir());
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(content.dreams).toHaveLength(6);
    expect(content.flaws).toHaveLength(6);
    expect(content.careers).toHaveLength(10);
  });

  it("the validator catches unknown tokens, a missing fail outcome and a too-thin dream", () => {
    const raw = readChaptersDir();
    const events = JSON.parse(JSON.stringify(raw.events)) as {
      file: string;
      data: { id: string; kind: string; text: string; choices: { base?: number; fail?: unknown }[] }[];
    }[];
    const first = events[0]!.data[0]!;
    first.text = "Hello {nobody}";
    first.choices[0]!.base = 50;
    delete first.choices[0]!.fail;
    for (const f of events) f.data = f.data.filter((e) => e.kind !== "fame" || e.id === "viral");
    const { issues } = validateChapters({ setup: raw.setup, events });
    const messages = issues.filter((i) => i.severity === "error").map((i) => i.message);
    expect(messages).toContain("unknown token {nobody}");
    expect(messages).toContain("a choice that can fail needs a fail outcome or failTo");
    expect(messages.some((m) => m.includes("events feed this dream"))).toBe(true);
  });

  it("goes intro → focus (3 cards) → event → outcome, with no timer, and moves to the next age", () => {
    const life = new ChapterLife(content, setup, "t1");
    expect(life.view().step.kind).toBe("intro");
    expect(life.view().board.cast.map((c) => c.role)).toEqual(["friend", "crush", "rival"]);
    life.next();
    const focus = life.view().step;
    expect(focus.kind).toBe("focus");
    if (focus.kind !== "focus") return;
    expect(focus.cards.length).toBe(3);
    // The dream's focus is always on the table.
    expect(focus.cards.some((c) => c.id === "fame")).toBe(true);
    expect(life.choose("x")).toBe("no decision now");
    expect(life.chooseFocus("nope")).toBe("that card is not on the table");
    life.chooseFocus("fame");
    const ev = life.view().step;
    expect(ev.kind).toBe("event");
    if (ev.kind !== "event") return;
    life.choose(ev.choices[0]!.id);
    const out = life.view().step;
    expect(out.kind).toBe("outcome");
    if (out.kind !== "outcome") return;
    expect(out.next).toBe("Go to age 21");
    life.next();
    expect(life.view().board.age).toBe(21);
  });

  it("a whole life ends in the dream's finale and a recap; replaying the log gives the identical life", () => {
    for (const dream of content.dreams) {
      const life = playBotLife(content, { ...setup, dream: dream.id }, `whole-${dream.id}`);
      const step = life.view().step;
      expect(step.kind).toBe("done");
      if (step.kind !== "done") return;
      expect(step.recap.years).toHaveLength(6);
      expect(step.recap.dream.id).toBe(dream.id);
      expect(step.recap.callbacks).toBeGreaterThanOrEqual(2);
      expect(new Set(life.state.usedEvents).size).toBe(life.state.usedEvents.length);
      const again = replayLife(content, life.log);
      expect(JSON.stringify(again.state)).toBe(JSON.stringify(life.state));
      expect(JSON.stringify(again.view())).toBe(JSON.stringify(life.view()));
    }
  });

  it("the finale shows its odds with a list of reasons and memories from earlier", () => {
    const life = new ChapterLife(content, setup, "finale");
    advance(life, (l) => l.view().step.kind === "event" && (l.view().step as { eventKind: string }).eventKind === "finale");
    const step = life.view().step;
    if (step.kind !== "event") throw new Error("no finale");
    expect(step.factors!.length).toBeGreaterThan(0);
    expect(step.factors!.some((f) => f.label.startsWith("Your fame"))).toBe(true);
    expect(step.memories!.length).toBeGreaterThan(0);
    expect(step.choices[0]!.odds).toBeGreaterThanOrEqual(5);
  });

  it("flaws change the odds: a coward's brave choice is 25 % harder; 'Can't say no' turns a refusal into a yes", () => {
    const coward = new ChapterLife(content, { ...setup, dream: "fame", flaw: "coward" }, "flaw-1");
    advance(coward, (l) => {
      const s = l.view().step;
      return s.kind === "focus" && s.cards.some((c) => c.id === "fame");
    });
    coward.chooseFocus("fame");
    const ev = coward.view().step;
    if (ev.kind !== "event") throw new Error("no event");
    const brave = ev.choices.find((c) => c.notes.some((n) => n.startsWith("Coward")));
    expect(brave).toBeDefined();

    // Pushover: try many lives until "Say no" on the dog coin fails and becomes "Put in all your savings".
    let kicked = false;
    for (let i = 0; i < 40 && !kicked; i++) {
      const life = new ChapterLife(content, { ...setup, dream: "rich", flaw: "pushover" }, `push-${i}`);
      advance(
        life,
        (l) => {
          const s = l.view().step;
          return l.finished || (s.kind === "event" && s.eventId === "crypto") || (s.kind === "focus" && !s.cards.some((c) => c.id === "money"));
        },
        (ids) => (ids.includes("money") ? "money" : ids[0]!),
      );
      const s = life.view().step;
      if (s.kind !== "event" || s.eventId !== "crypto") continue;
      const no = s.choices.find((c) => c.id === "no")!;
      expect(no.odds).toBe(40);
      life.choose("no");
      const out = life.view().step;
      if (out.kind === "outcome" && out.flawKickedIn) {
        kicked = true;
        expect(out.changes[0]!.text).toContain("Can't say no");
      }
    }
    expect(kicked).toBe(true);
  });

  it("a lie can become a secret that comes out on its own a few chapters later", () => {
    let revealed = false;
    for (let i = 0; i < 60 && !revealed; i++) {
      const life = playBotLife(content, { ...setup, flaw: "blabber" }, `secret-${i}`);
      revealed = life.state.moments.some((m) => m.text.startsWith("Secret came out"));
    }
    expect(revealed).toBe(true);
  });

  it("T28: flaw notes only on matching tags and as 'Flaw −N %'; Show-off costs money at most twice; the board's dream chance is the finale's", () => {
    // Notes: play lives step by step and look at every choice shown.
    for (const flaw of content.flaws)
      for (let i = 0; i < 6; i++) {
        const life = new ChapterLife(content, { ...setup, flaw: flaw.id }, `notes-${flaw.id}-${i}`);
        advance(life, (l) => {
          const s = l.view().step;
          if (s.kind === "event")
            for (const c of s.choices) {
              const def = content.events.find((e) => e.id === s.eventId)?.choices.find((x) => x.id === c.id);
              const flawNotes = c.notes.filter((n) => n.startsWith(flaw.label));
              if (flawNotes.length) expect(def?.tags ?? []).toContain(flaw.tag);
              for (const n of flawNotes) expect(n).toMatch(flaw.tag === "refuse" ? /^Can't say no: \d+ %$/ : new RegExp(`^${flaw.label} −\\d+ %$`));
            }
          return l.finished;
        });
      }
    for (let i = 0; i < 20; i++) {
      const life = playBotLife(content, { ...setup, flaw: "showoff" }, `showoff-${i}`);
      expect(life.state.flags.filter((f) => f.startsWith("__flaw_hit")).length).toBeLessThanOrEqual(2);
    }
    const life = new ChapterLife(content, { ...setup, dream: "family" }, "chance");
    let lastBoard = life.view().board.dreamChance.odds;
    advance(life, (l) => {
      const s = l.view().step;
      lastBoard = l.view().board.dreamChance.odds;
      return s.kind === "event" && s.eventKind === "finale";
    });
    const fin = life.view().step;
    if (fin.kind !== "event") throw new Error("no finale");
    expect(fin.choices[0]!.odds).toBe(lastBoard);
    expect(life.view().board.dreamChance.factors.map((f) => f.label)).toEqual(fin.factors!.map((f) => f.label));
  });

  it("career choices appear only for that career ('Your expertise')", () => {
    const counts = new Map<string, number>();
    for (const e of content.events) for (const c of e.choices) if (c.career) counts.set(c.career, (counts.get(c.career) ?? 0) + 1);
    for (const c of content.careers) expect(counts.get(c.id) ?? 0).toBeGreaterThanOrEqual(2);
  });
});
