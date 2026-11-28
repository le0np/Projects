import { describe, expect, it } from "vitest";
import { Rng } from "../src";

const draw = (rng: Rng, n = 20) => Array.from({ length: n }, () => rng.nextUint32());

describe("Rng", () => {
  it("is deterministic for the same seed", () => {
    expect(draw(new Rng("abc"))).toEqual(draw(new Rng("abc")));
    expect(draw(new Rng("abc"))).not.toEqual(draw(new Rng("abd")));
  });

  it("forks depend only on seed and name, not on prior draws", () => {
    const a = new Rng("s");
    const b = new Rng("s");
    draw(b, 100);
    expect(draw(a.fork("bots"))).toEqual(draw(b.fork("bots")));
    expect(draw(a.fork("bots"))).not.toEqual(draw(a.fork("selection")));
  });

  it("int stays in range and covers it", () => {
    const rng = new Rng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(() => rng.int(3, 1)).toThrow();
  });

  it("next() is roughly uniform", () => {
    const rng = new Rng("uniform");
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) buckets[Math.floor(rng.next() * 10)]++;
    for (const b of buckets) expect(Math.abs(b - 2000)).toBeLessThan(250);
  });

  it("weightedIndex respects weights and ignores non-positive ones", () => {
    const rng = new Rng("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[rng.weightedIndex([1, 0, 3])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.5);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.5);
    expect(rng.weightedIndex([0, -1])).toBe(-1);
  });

  it("chance handles edge probabilities", () => {
    const rng = new Rng("chance");
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it("shuffle returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = new Rng("shuffle").shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
