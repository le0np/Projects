/**
 * Matchmaking (GDD §4): players queue with their chosen career; a session starts as soon as
 * enough humans are waiting, or when the oldest ticket has waited `fillAfterMs` — then bots
 * fill the empty slots, so the game never depends on a large online population.
 */
export interface Ticket {
  userId: string;
  name: string;
  career: string;
  enqueuedAt: number;
}

export interface MatchmakerOptions {
  /** Characters per session (humans + bots). */
  sessionSize: number;
  /** Max humans per session. */
  maxHumans: number;
  /** Start with bots after the oldest ticket waited this long. */
  fillAfterMs: number;
  onMatch(tickets: Ticket[]): void;
  now?: () => number;
}

export class Matchmaker {
  private queue: Ticket[] = [];
  private readonly now: () => number;

  constructor(private readonly opts: MatchmakerOptions) {
    if (opts.maxHumans < 1 || opts.maxHumans > opts.sessionSize) throw new RangeError("invalid maxHumans");
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.queue.length;
  }

  has(userId: string): boolean {
    return this.queue.some((t) => t.userId === userId);
  }

  enqueue(userId: string, name: string, career: string): void {
    this.cancel(userId);
    this.queue.push({ userId, name, career, enqueuedAt: this.now() });
    this.tick();
  }

  cancel(userId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((t) => t.userId !== userId);
    return this.queue.length !== before;
  }

  status(userId: string): { position: number; waitedMs: number; queueSize: number; fillInMs: number } | null {
    const i = this.queue.findIndex((t) => t.userId === userId);
    if (i < 0) return null;
    const oldest = this.queue[0] as Ticket;
    const waited = this.now() - (this.queue[i] as Ticket).enqueuedAt;
    return {
      position: i + 1,
      waitedMs: waited,
      queueSize: this.queue.length,
      fillInMs: Math.max(0, this.opts.fillAfterMs - (this.now() - oldest.enqueuedAt)),
    };
  }

  /** Call periodically; starts as many sessions as the queue allows. */
  tick(): void {
    for (;;) {
      const oldest = this.queue[0];
      if (!oldest) return;
      const full = this.queue.length >= this.opts.maxHumans;
      const waitedEnough = this.now() - oldest.enqueuedAt >= this.opts.fillAfterMs;
      if (!full && !waitedEnough) return;
      const tickets = this.queue.splice(0, this.opts.maxHumans);
      this.opts.onMatch(tickets);
    }
  }
}
