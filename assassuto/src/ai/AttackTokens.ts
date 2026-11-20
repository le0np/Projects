/**
 * Limits how many enemies attack the player at once (GDD 10: consider nearby allies), so groups
 * take turns instead of swarming. Tokens expire if not returned.
 */
export class AttackTokens {
  private holders = new Map<string, number>();

  constructor(
    private readonly max: number,
    private readonly hold: number,
  ) {}

  request(id: string, now: number): boolean {
    for (const [k, t] of this.holders) if (now - t > this.hold) this.holders.delete(k);
    if (this.holders.has(id)) return true;
    if (this.holders.size >= this.max) return false;
    this.holders.set(id, now);
    return true;
  }

  release(id: string): void {
    this.holders.delete(id);
  }

  get count(): number {
    return this.holders.size;
  }
}
