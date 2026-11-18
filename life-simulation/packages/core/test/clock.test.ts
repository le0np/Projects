import { describe, expect, it } from "vitest";
import { TimerQueue, VirtualClock } from "../src";

describe("VirtualClock", () => {
  it("advances and refuses to go backwards", () => {
    const clock = new VirtualClock();
    clock.advanceBy(500);
    clock.advanceTo(1200);
    expect(clock.now()).toBe(1200);
    expect(() => clock.advanceTo(1000)).toThrow();
  });
});

describe("TimerQueue", () => {
  it("pops due entries in time order, FIFO for ties", () => {
    const q = new TimerQueue<string>();
    q.push(300, "c");
    q.push(100, "a1");
    q.push(200, "b");
    q.push(100, "a2");
    expect(q.nextAt()).toBe(100);
    expect(q.popDue(150)).toEqual(["a1", "a2"]);
    expect(q.popDue(150)).toEqual([]);
    expect(q.popDue(1000)).toEqual(["b", "c"]);
    expect(q.size).toBe(0);
    expect(q.nextAt()).toBeUndefined();
  });

  it("can cancel timers", () => {
    const q = new TimerQueue<string>();
    const id = q.push(10, "x");
    q.push(20, "y");
    expect(q.cancel(id)).toBe(true);
    expect(q.cancel(id)).toBe(false);
    expect(q.popDue(100)).toEqual(["y"]);
  });
});
