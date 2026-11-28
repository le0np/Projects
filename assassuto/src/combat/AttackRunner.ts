import type { AttackDef, AttackInput, WeaponDef } from '../config/combat';

/** One running attack. `instance` is unique per swing so a target is hit at most once per swing. */
export interface ActiveAttack {
  def: AttackDef;
  instance: number;
  t: number;
  /** True once the hit window opened at least once (used to emit `hitOpened` exactly once). */
  opened: boolean;
  /** Last move of a combo string: hits harder. */
  ender: boolean;
  /** Button whose combo string this move belongs to (null for scripted moves). */
  input: AttackInput | null;
}

/** What an input would start: the move and where it sits in a combo string. */
export interface AttackPlan {
  id: string;
  combo: { input: AttackInput; index: number; moves: string[]; pick: number } | null;
}

let nextInstance = 1;

/**
 * Pure combo state machine (GDD 8.2): which attack plays, when hits are live, and which input chains
 * into what. Each button has several combo strings; a new string is picked at random (never the same
 * one twice in a row) so the fighter mixes up their attacks. Pressing the other button mid-string
 * chains into one of its strings. Time is advanced explicitly, so it is deterministic and testable.
 */
export class AttackRunner {
  current: ActiveAttack | null = null;
  /** Number of consecutive attacks in the current chain. */
  chain = 0;
  private combo: AttackPlan['combo'] = null;
  private lastPick: Record<AttackInput, number> = { light: -1, heavy: -1 };
  private rolled: Record<AttackInput, number> = { light: 0, heavy: 0 };
  private _weapon!: WeaponDef;

  constructor(
    weapon: WeaponDef,
    private readonly random: () => number = Math.random,
  ) {
    this.weapon = weapon;
  }

  get weapon(): WeaponDef {
    return this._weapon;
  }

  set weapon(w: WeaponDef) {
    this._weapon = w;
    this.combo = null;
    this.lastPick = { light: -1, heavy: -1 };
    this.roll('light');
    this.roll('heavy');
  }

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

  /** The combo string in progress (for HUD/debug). */
  get comboMoves(): readonly string[] | null {
    return this.combo?.moves ?? null;
  }

  private roll(input: AttackInput): void {
    const n = this._weapon.combos[input].length;
    if (n <= 1) {
      this.rolled[input] = 0;
      return;
    }
    let k = Math.floor(this.random() * n) % n;
    if (k === this.lastPick[input]) k = (k + 1 + Math.floor(this.random() * (n - 1))) % n;
    this.rolled[input] = k;
  }

  private fresh(input: AttackInput): AttackPlan {
    const pick = this.rolled[input];
    const moves = this._weapon.combos[input][pick];
    return { id: moves[0], combo: { input, index: 0, moves, pick } };
  }

  /** Starts a scripted move (counter, finisher, air attack) or a planned combo step. */
  start(plan: string | AttackPlan): ActiveAttack {
    const p: AttackPlan = typeof plan === 'string' ? { id: plan, combo: null } : plan;
    const def = this._weapon.attacks[p.id];
    if (!def) throw new Error(`Unknown attack ${p.id}`);
    this.combo = p.combo;
    if (p.combo && p.combo.index === 0) {
      this.lastPick[p.combo.input] = p.combo.pick;
      this.roll(p.combo.input);
    }
    const ender = !!p.combo && p.combo.moves.length >= 2 && p.combo.index === p.combo.moves.length - 1;
    this.current = { def, instance: nextInstance++, t: 0, opened: false, ender, input: p.combo?.input ?? null };
    this.chain++;
    return this.current;
  }

  /** What an input would start now, or null if it must wait/buffer. Does not change state. */
  resolve(input: AttackInput, ctx: { airborne: boolean; counterReady: boolean }): AttackPlan | null {
    const c = this.current;
    if (!c) {
      if (ctx.counterReady && input === 'light') return { id: this._weapon.counter, combo: null };
      if (ctx.airborne) return { id: this._weapon.air, combo: null };
      return this.fresh(input);
    }
    const [a, b] = c.def.comboWindow;
    if (c.t < a || c.t > b) return null;
    if (ctx.airborne) return null;
    const k = this.combo;
    if (k && k.input === input && k.index + 1 < k.moves.length) return { id: k.moves[k.index + 1], combo: { ...k, index: k.index + 1 } };
    // String finished, or the other button: chain straight into a new string.
    return this.fresh(input);
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
      this.combo = null;
    }
    return { opened, closed, finished };
  }

  cancel(): void {
    this.current = null;
    this.chain = 0;
    this.combo = null;
  }
}
