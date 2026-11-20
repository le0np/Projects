/** Remembers recent combat inputs so presses slightly before a combo window still count (GDD 8.2). */
export class InputBuffer<T extends string> {
  private items: { input: T; time: number }[] = [];

  constructor(private readonly window: number) {}

  push(input: T, now: number): void {
    this.items.push({ input, time: now });
    if (this.items.length > 8) this.items.shift();
  }

  /** Oldest still-valid input matching the predicate; it is removed. */
  consume(now: number, accept: (i: T) => boolean = () => true): T | null {
    this.items = this.items.filter((i) => now - i.time <= this.window);
    const idx = this.items.findIndex((i) => accept(i.input));
    if (idx < 0) return null;
    return this.items.splice(idx, 1)[0].input;
  }

  peek(now: number): T | null {
    const live = this.items.filter((i) => now - i.time <= this.window);
    return live.length ? live[0].input : null;
  }

  clear(): void {
    this.items = [];
  }
}
