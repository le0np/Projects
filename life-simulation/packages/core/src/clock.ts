/**
 * Time abstraction. The engine never reads wall-clock time directly:
 * the simulator drives a `VirtualClock` (jumping straight to the next deadline),
 * the server will drive a real-time clock. Times are milliseconds since session start.
 */
export interface Clock {
  now(): number;
}

export class VirtualClock implements Clock {
  private t: number;

  constructor(start = 0) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  advanceTo(t: number): void {
    if (t < this.t) throw new RangeError(`VirtualClock cannot move backwards (${this.t} → ${t})`);
    this.t = t;
  }

  advanceBy(ms: number): void {
    this.advanceTo(this.t + ms);
  }
}

interface TimerEntry<T> {
  id: number;
  at: number;
  payload: T;
}

/**
 * Deterministic timer queue: entries fire in order of time, and in insertion
 * order for equal times. Used for deadlines, delayed consequences and bot think time.
 */
export class TimerQueue<T> {
  private entries: TimerEntry<T>[] = [];
  private seq = 0;

  get size(): number {
    return this.entries.length;
  }

  push(at: number, payload: T): number {
    const entry = { id: ++this.seq, at, payload };
    // Insert after every entry with at <= new.at (keeps FIFO for ties).
    let lo = 0;
    let hi = this.entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.entries[mid] as TimerEntry<T>).at <= at) lo = mid + 1;
      else hi = mid;
    }
    this.entries.splice(lo, 0, entry);
    return entry.id;
  }

  cancel(id: number): boolean {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i < 0) return false;
    this.entries.splice(i, 1);
    return true;
  }

  /** Time of the earliest entry, or undefined if empty. */
  nextAt(): number | undefined {
    return this.entries[0]?.at;
  }

  /** Removes and returns all payloads due at or before `now`, in firing order. */
  popDue(now: number): T[] {
    let n = 0;
    while (n < this.entries.length && (this.entries[n] as TimerEntry<T>).at <= now) n++;
    return this.entries.splice(0, n).map((e) => e.payload);
  }
}
