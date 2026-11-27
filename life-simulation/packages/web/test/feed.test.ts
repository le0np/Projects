import { describe, expect, it } from "vitest";
import { isNewsworthy } from "../src/format";

describe("B3: Around town shows news, not other people's errands", () => {
  const person = { characterId: "c1", name: "Kim", role: "taxpayer" };
  it("keeps events with more than one person, upheavals, endings and the finale", () => {
    expect(isNewsworthy({ kind: "event", participants: [person] })).toBe(false); // "Kim receives a tax refund."
    expect(isNewsworthy({ kind: "event", participants: [person, { ...person, characterId: "c2" }] })).toBe(true);
    expect(isNewsworthy({ kind: "upheaval", active: true })).toBe(true);
    expect(isNewsworthy({ kind: "upheaval", active: false })).toBe(false);
    expect(isNewsworthy({ kind: "ended" })).toBe(true); // deaths, hospital, prison
    expect(isNewsworthy({ kind: "phase", phase: "finale" })).toBe(true);
    expect(isNewsworthy({ kind: "phase", phase: "climax" })).toBe(false);
    expect(isNewsworthy({ kind: "season" })).toBe(false);
    expect(isNewsworthy({ kind: "move" })).toBe(false);
  });
});

describe("T5b R1: quotes around choice labels", async () => {
  const { quoted } = await import("../src/format");
  it("adds quotes once, never doubles them", () => {
    expect(quoted("Count fairly")).toBe("“Count fairly”");
    expect(quoted('"Go to the bathroom" and never come back')).toBe('"Go to the bathroom" and never come back');
    expect(quoted("„Ja”")).toBe("„Ja”");
    expect(quoted(undefined)).toBe("");
  });
});
