import type { AttackDef, AttackInput, WeaponDef } from '../config/combat';

/** One running attack. `instance` is unique per swing so a target is hit at most once per swing. */
export interface ActiveAttack {
  def: AttackDef;
  instance: number;
  t: number;
  /** True once the hit window opened at least once (used to emit `hitOpened` exactly once). */
  opened: boolean;
}

let nextInstance = 1;

/**
 * Pure combo state machine (GDD 8.2): which attack plays, when hits are live, and which input chains
 * into what. Time is advanced explicitly, so it is fully deterministic and testable.
 */
export class AttackRunner {
  current: ActiveAttack | null = null;
  /** Number of consecutive attacks in the current chain. */
  chain = 0;

  constructor(public weapon: WeaponDef) {}

  get busy(): boolean {
    return this.current !== null;
  }

  get hitActive(): boolean {
    const c = this.current;
    return !!c && c.t >= c.def.hitStart && c.t <= c.def.hitEnd;
  }

  /** Can the move be cancelled into a dodge or block right now? */
  get cancelable(): boolean {
    const c = this.current;
    return !c || c.t >= c.def.cancelAfter;
  }

  start(id: string): ActiveAttack {
    const def = this.weapon.attacks[id];
    if (!def) throw new Error(`Unknown attack ${id}`);
    this.current = { def, instance: nextInstance++, t: 0, opened: false };
    this.chain++;
    return this.current;
  }

  /** Returns the attack id an input would start now, or null if it must wait/buffer. */
  resolve(input: AttackInput, ctx: { airborne: boolean; counterReady: boolean }): string | null {
    const c = this.current;
    if (!c) {
      if (ctx.counterReady && input === 'light') return this.weapon.counter;
      if (ctx.airborne) return this.weapon.air;
      return this.weapon.start[input];
    }
    const [a, b] = c.def.comboWindow;
    if (c.t < a || c.t > b) return null;
    return c.def.next?.[input] ?? null;
  }

  /** Advances time. Returns events that happened during this step. */
  step(dt: number): { opened: boolean; closed: boolean; finished: boolean } {
    const c = this.current;
    if (!c) return { opened: false, closed: false, finished: false };
    const before = c.t;
    c.t += dt;
    const opened = !c.opened && c.t >= c.def.hitStart;
    if (opened) c.opened = true;
    const closed = before <= c.def.hitEnd && c.t > c.def.hitEnd;
    const finished = c.t >= c.def.duration;
    if (finished) {
      this.current = null;
      this.chain = 0;
    }
    return { opened, closed, finished };
  }

  cancel(): void {
    this.current = null;
    this.chain = 0;
  }
}
