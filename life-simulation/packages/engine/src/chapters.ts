/**
 * Sprint 5 (T20/T22): "Life in chapters" — one life from 18 to 33 in six turns, after the design
 * prototype (`prototype/index.html`). The player acts (`next`, `chooseFocus`, `choose`); everything
 * random (cards, events, rolls, what the cast decides) comes from seeded `Rng` streams, so replaying
 * the action log gives the identical life.
 */
import {
  CAST_ROLES,
  CHAPTER_AGES,
  FINALE_CHAPTER,
  FOCUSES,
  Rng,
  TWIST_CHAPTER,
  type CastMember,
  type CastRole,
  type CastView,
  type ChapterContent,
  type ChapterRecap,
  type ChoiceView,
  type Dream,
  type Flaw,
  type LifeBoard,
  type LifeCareer,
  type LifeChange,
  type LifeChoice,
  type LifeCond,
  type LifeEffect,
  type LifeEvent,
  type LifeOutcome,
  type LifeStat,
  type LifeStep,
  type LifeText,
  type LifeView,
  type PersonRef,
} from "@lifesim/core";

export interface LifeSetup {
  name: string;
  dream: string;
  flaw: string;
  career: string;
}

export type LifeAction = { t: "next" } | { t: "focus"; id: string } | { t: "choose"; id: string };
export type LifeLogEntry = { t: "start"; seed: string; setup: LifeSetup; contentHash: string } | (LifeAction & { roll?: number; ok?: boolean });

interface Secret {
  id: string;
  text: string;
  about?: CastRole;
  due: number;
  reveal: { text: string; emoji: string; effects?: LifeEffect[] };
}

export interface LifeState {
  setup: LifeSetup;
  chapter: number;
  money: number;
  rep: number;
  fame: number;
  jobLevel: number;
  home: string;
  partner: boolean;
  married: boolean;
  kids: number;
  rel: Record<CastRole, number>;
  cast: Record<CastRole, string>;
  helped: Record<CastRole, number>;
  hurt: Record<CastRole, number>;
  flags: string[];
  secrets: Secret[];
  moments: { age: number; text: string }[];
  /** For callbacks: who each moment was about (by index into `moments`), and which were already recalled. */
  momentPeople: { chapter: number; roles: CastRole[]; recalled: boolean }[];
  years: (string | null)[];
  usedEvents: string[];
  exposed: number;
  lies: number;
  damageCount: number;
  twistDone: boolean;
  mood: "good" | "ok" | "bad";
  callbacks: number;
  dreamDone: boolean | null;
  factors: { label: string; value: number }[];
}

/** The event being played, with everything already rendered. */
interface Active {
  id: string;
  kind: string;
  auto: boolean;
  title: string;
  text: string;
  private?: string;
  recall?: { name: string; color: string; text: string };
  memories?: string[];
  factors?: { label: string; value: number }[];
  choices: { def: LifeChoice; view: ChoiceView }[];
  target?: CastRole;
  secret?: Secret;
  finaleOdds?: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ROLE_ORDER: CastRole[] = ["rival", "friend", "crush"];

export class ChapterLife {
  readonly state: LifeState;
  readonly log: LifeLogEntry[] = [];
  private step: LifeStep;
  private active: Active | null = null;
  private changes: LifeChange[] = [];
  private readonly dream: Dream;
  private readonly flaw: Flaw;
  private readonly career: LifeCareer;
  private readonly members: Record<CastRole, CastMember>;
  private readonly rngFocus: Rng;
  private readonly rngEvents: Rng;
  private readonly rngRolls: Rng;
  private readonly rngCast: Rng;

  constructor(
    private readonly content: ChapterContent,
    setup: LifeSetup,
    readonly seed: string,
  ) {
    const dream = content.dreams.find((d) => d.id === setup.dream);
    const flaw = content.flaws.find((f) => f.id === setup.flaw);
    const career = content.careers.find((c) => c.id === setup.career);
    if (!dream || !flaw || !career) throw new Error("unknown dream, flaw or career");
    this.dream = dream;
    this.flaw = flaw;
    this.career = career;
    const rng = new Rng(seed);
    const rngPick = rng.fork("cast-pick");
    this.rngFocus = rng.fork("focus");
    this.rngEvents = rng.fork("events");
    this.rngRolls = rng.fork("rolls");
    this.rngCast = rng.fork("cast-decides");
    const members = {} as Record<CastRole, CastMember>;
    for (const role of CAST_ROLES) members[role] = rngPick.pick(content.cast.filter((c) => c.role === role));
    this.members = members;
    const per = (v: number) => ({ friend: v, crush: v, rival: v });
    this.state = {
      setup: { ...setup },
      chapter: 0,
      ...content.start,
      jobLevel: 0,
      home: content.startHome,
      partner: false,
      married: false,
      kids: 0,
      rel: { friend: members.friend.start, crush: members.crush.start, rival: members.rival.start },
      cast: { friend: members.friend.id, crush: members.crush.id, rival: members.rival.id },
      helped: per(0),
      hurt: per(0),
      flags: [],
      secrets: [],
      moments: [],
      momentPeople: [],
      years: CHAPTER_AGES.map(() => null),
      usedEvents: [],
      exposed: 0,
      lies: 0,
      damageCount: 0,
      twistDone: false,
      mood: "ok",
      callbacks: 0,
      dreamDone: null,
      factors: [],
    };
    this.log.push({ t: "start", seed, setup: { ...setup }, contentHash: content.hash });
    this.step = { kind: "intro", cast: this.castViews() };
  }

  get finished(): boolean {
    return this.step.kind === "done";
  }

  view(): LifeView {
    return { board: this.board(), step: this.step };
  }

  /** Applies a player action; returns an error text if it is not possible now. */
  act(a: LifeAction): string | null {
    if (a.t === "next") return this.next();
    if (a.t === "focus") return this.chooseFocus(a.id);
    return this.choose(a.id);
  }

  next(): string | null {
    if (this.step.kind === "intro") {
      this.log.push({ t: "next" });
      this.turn();
      return null;
    }
    if (this.step.kind !== "outcome") return "nothing to continue";
    this.log.push({ t: "next" });
    const active = this.active!;
    this.active = null;
    if (active.kind === "finale") {
      this.step = { kind: "done", recap: this.recap() };
      return null;
    }
    if (!active.auto) this.state.chapter++;
    this.turn();
    return null;
  }

  chooseFocus(id: string): string | null {
    if (this.step.kind !== "focus") return "not choosing a focus now";
    if (!this.step.cards.some((c) => c.id === id)) return "that card is not on the table";
    this.log.push({ t: "focus", id });
    const target = id === "revenge" ? this.revengeTarget() : undefined;
    const options = this.eventsFor(id, target);
    const event = this.rngEvents.pick(options);
    let secret: Secret | undefined;
    if (id === "damage") {
      this.state.damageCount++;
      secret = [...this.state.secrets].sort((a, b) => a.due - b.due)[0];
    }
    this.startEvent(event, { target, secret });
    return null;
  }

  choose(id: string): string | null {
    if (this.step.kind !== "event" || !this.active) return "no decision now";
    const active = this.active;
    const picked = active.choices.find((c) => c.def.id === id);
    if (!picked) return "no such choice";
    const c = picked.def;
    let roll: { roll: number; odds: number; ok: boolean } | undefined;
    let ok = true;
    if (picked.view.odds !== undefined) {
      const r = this.rngRolls.int(1, 100);
      ok = r <= picked.view.odds;
      roll = { roll: r, odds: picked.view.odds, ok };
    } else if (c.cast) {
      ok = this.castHelps(this.person(c.cast, active));
    }
    this.log.push({ t: "choose", id, ...(roll ? { roll: roll.roll } : {}), ok });
    if (c.tags?.includes("lie")) this.state.lies++;

    // A choice that always works, but your flaw got in the way: the flaw's own line.
    let outcome: LifeOutcome = ok ? c.ok : (c.fail ?? (c.failTo ? c.ok : { text: this.flaw.failText, emoji: this.flaw.failEmoji }));
    if (!ok && !c.fail && !c.failTo) this.change(`${this.flaw.icon} Your flaw: ${this.flaw.label}`, "warn");
    let shownLabel = picked.view.label;
    let flawKickedIn = false;
    if (!ok && !c.fail && c.failTo) {
      const alt = active.choices.find((x) => x.def.id === c.failTo)!;
      outcome = alt.def.ok;
      flawKickedIn = true;
      this.change(`${this.flaw.icon} ${this.flaw.label}: you ended up choosing “${alt.view.label}”`, "warn");
      shownLabel = picked.view.label;
    }
    const flawText = outcome.byFlaw?.[this.flaw.id];
    const text = this.render(flawText?.text ?? outcome.text, active);
    const emoji = flawText?.emoji ?? outcome.emoji;
    if (flawText && !flawKickedIn) this.change(`${this.flaw.icon} Your flaw: ${this.flaw.label}`, "warn");
    this.apply(flawText?.effects ?? outcome.effects ?? [], active);
    let cast: Extract<LifeStep, { kind: "outcome" }>["cast"];
    if (outcome.cast) {
      const role = this.person(outcome.cast.who, active);
      if (role) {
        const m = this.members[role];
        cast = { name: m.name, color: m.color, did: this.render(outcome.cast.did, active), tone: this.state.rel[role] >= 1 ? "good" : "bad" };
      }
    }
    if (active.kind === "finale") {
      this.state.dreamDone = ok;
      this.state.factors = active.factors ?? [];
      this.moment(ok ? "Your dream came true." : "Your dream didn't come true.");
    }
    // The year's emoji: what you chose; a revealed secret only fills an empty year.
    const ch = Math.min(this.state.chapter, FINALE_CHAPTER);
    if (active.kind !== "secret" || !this.state.years[ch]) this.state.years[ch] = emoji;
    const good = this.changes.filter((x) => x.tone === "good").length;
    const bad = this.changes.filter((x) => x.tone === "bad").length;
    this.state.mood = good > bad ? "good" : bad > good ? "bad" : "ok";
    const nextAge = CHAPTER_AGES[Math.min(this.state.chapter + 1, FINALE_CHAPTER)];
    this.step = {
      kind: "outcome",
      age: CHAPTER_AGES[ch] as number,
      title: active.title,
      choiceLabel: shownLabel,
      ...(roll ? { roll } : {}),
      ...(flawKickedIn ? { flawKickedIn } : {}),
      ...(cast ? { cast } : {}),
      text,
      emoji,
      changes: this.changes,
      next: active.kind === "finale" ? "See your life" : active.auto ? "Continue" : `Go to age ${nextAge}`,
      finale: active.kind === "finale",
    };
    return null;
  }

  // ------------------------------------------------------------------ the turn

  private turn(): void {
    this.changes = [];
    const s = this.state;
    if (s.chapter >= FINALE_CHAPTER) return this.startFinale();
    const due = s.secrets.filter((x) => x.due <= s.chapter).sort((a, b) => a.due - b.due)[0];
    if (due) return this.startReveal(due);
    if (s.chapter === TWIST_CHAPTER && !s.twistDone) {
      const twists = this.content.events.filter((e) => e.kind === "twist" && this.fits(e));
      if (twists.length > 0) {
        s.twistDone = true;
        return this.startEvent(this.rngEvents.pick(twists), { auto: true });
      }
    }
    if (s.chapter > 0 && this.flaw.everyChapter && !s.flags.includes(`__flaw_${s.chapter}`)) {
      s.flags.push(`__flaw_${s.chapter}`);
      this.apply(this.flaw.everyChapter.effects, null);
      this.change(this.flaw.everyChapter.note, "warn");
    }
    const cards = this.drawFocus();
    if (cards.length === 0) {
      // Nothing left to do this chapter (should not happen with enough content): the year passes.
      s.chapter++;
      return this.turn();
    }
    this.step = {
      kind: "focus",
      age: CHAPTER_AGES[s.chapter] as number,
      cards: cards.map((id) => {
        const f = this.content.focuses.find((x) => x.id === id)!;
        const target = id === "revenge" ? this.revengeTarget() : undefined;
        return { id, icon: f.icon, label: f.label, hint: this.render(f.hint, { target }, false) };
      }),
    };
  }

  private available(): string[] {
    const list: string[] = [];
    for (const f of FOCUSES) {
      if (f === "revenge") {
        const t = this.revengeTarget();
        if (t && this.eventsFor(f, t).length > 0) list.push(f);
      } else if (f === "damage") {
        if (this.state.secrets.length > 0 && this.state.damageCount < 2 && this.eventsFor(f).length > 0) list.push(f);
      } else if (this.eventsFor(f).length > 0) list.push(f);
    }
    return list;
  }

  private drawFocus(): string[] {
    const all = this.available();
    const must: string[] = all.filter((k) => k === "damage" || k === "revenge");
    const dreamOptions = all.filter((k) => (this.dream.focus as string[]).includes(k) && !must.includes(k));
    const pref = dreamOptions.length > 0 ? [this.rngFocus.pick(dreamOptions)] : [];
    const rest = this.rngFocus.shuffle(all.filter((k) => !must.includes(k) && !pref.includes(k)));
    return [...must, ...pref, ...rest].slice(0, 3);
  }

  private eventsFor(kind: string, target?: CastRole): LifeEvent[] {
    return this.content.events.filter((e) => e.kind === kind && !this.state.usedEvents.includes(e.id) && this.fits(e, target));
  }

  private fits(e: LifeEvent, target?: CastRole): boolean {
    return !e.when || this.cond(e.when, target);
  }

  private revengeTarget(): CastRole | undefined {
    const worst = [...ROLE_ORDER].sort((a, b) => this.state.rel[a] - this.state.rel[b])[0] as CastRole;
    return this.state.rel[worst] <= -2 ? worst : undefined;
  }

  private startEvent(e: LifeEvent, opts: { auto?: boolean; target?: CastRole; secret?: Secret }): void {
    this.state.usedEvents.push(e.id);
    const ctx = { target: opts.target, secret: opts.secret };
    const active: Active = {
      id: e.id,
      kind: e.kind,
      auto: !!opts.auto,
      title: this.render(e.title, ctx),
      text: this.render(e.text, ctx),
      ...(e.private ? { private: this.render(e.private, ctx) } : {}),
      choices: [],
      ...(opts.target ? { target: opts.target } : {}),
      ...(opts.secret ? { secret: opts.secret } : {}),
    };
    active.recall = this.recall([e.title, e.text, e.private], opts.target);
    active.choices = e.choices
      .filter((c) => (!c.career || c.career === this.state.setup.career) && (!c.when || this.cond(c.when, opts.target)))
      .map((c) => ({ def: c, view: this.choiceView(c, active) }));
    this.active = active;
    this.showEvent();
  }

  private startReveal(secret: Secret): void {
    this.state.secrets = this.state.secrets.filter((x) => x !== secret);
    this.state.exposed++;
    this.state.callbacks++;
    this.moment(`Secret came out: ${secret.text}.`);
    const choice: LifeChoice = { id: "oh_no", label: "Oh no", ok: { text: secret.reveal.text, emoji: secret.reveal.emoji, effects: secret.reveal.effects ?? [] } };
    this.active = {
      id: `reveal_${secret.id}`,
      kind: "secret",
      auto: true,
      title: "Your Secret Is Out",
      text: `Some secrets don't stay buried. This one: “${secret.text}.”`,
      choices: [{ def: choice, view: { id: "oh_no", label: "Oh no", notes: [] } }],
      secret,
      ...(secret.about ? { target: secret.about } : {}),
    };
    this.showEvent();
  }

  private startFinale(): void {
    const f = this.dream.finale;
    const factors: { label: string; value: number }[] = [];
    for (const x of f.factors) {
      if (x.when && !this.cond(x.when)) continue;
      let v = (x.add ?? 0) + (x.per ? this.stat(x.per.stat) * x.per.mul : 0);
      if (x.cap !== undefined) v = Math.min(v, x.cap);
      if (x.floor !== undefined) v = Math.max(v, x.floor);
      factors.push({ label: this.render(x.label, {}, false), value: Math.round(v) });
      // A reason that comes from an earlier choice ("You fixed the pothole") is a callback.
      if (x.when?.flags?.length) this.state.callbacks++;
    }
    const odds = clamp(f.base + factors.reduce((a, b) => a + b.value, 0), 5, 95);
    const choice: LifeChoice = {
      id: "go",
      label: "Go for it",
      base: odds,
      ok: { text: f.success.text, emoji: f.success.emoji },
      fail: { text: f.failure.text, emoji: f.failure.emoji },
    };
    this.active = {
      id: `finale_${this.dream.id}`,
      kind: "finale",
      auto: true,
      title: this.render(f.title, {}),
      text: this.render(f.text, {}),
      factors,
      memories: this.flashback(2),
      choices: [{ def: choice, view: { id: "go", label: "Go for it", odds, notes: [] } }],
      finaleOdds: odds,
    };
    this.showEvent();
  }

  private showEvent(): void {
    const a = this.active!;
    const focus = this.content.focuses.find((f) => f.id === a.kind);
    this.step = {
      kind: "event",
      age: CHAPTER_AGES[Math.min(this.state.chapter, FINALE_CHAPTER)] as number,
      eventId: a.id,
      eventKind: a.kind,
      focusLabel: a.kind === "secret" ? "🤫 it was bound to happen" : a.kind === "twist" ? "🌊 the whole town" : a.kind === "finale" ? "🏁 your dream" : focus ? `${focus.icon} ${focus.label}` : a.kind,
      title: a.title,
      text: a.text,
      ...(a.private ? { private: a.private } : {}),
      ...(a.recall ? { recall: a.recall } : {}),
      ...(a.memories?.length ? { memories: a.memories } : {}),
      ...(a.factors ? { factors: a.factors } : {}),
      choices: a.choices.map((c) => c.view),
    };
  }

  private choiceView(c: LifeChoice, active: Active): ChoiceView {
    const notes: string[] = [];
    let odds = c.base;
    for (const m of c.mods ?? []) {
      if (!this.cond(m.when, active.target)) continue;
      odds = (odds ?? 100) + m.add;
      notes.push(`${m.note} ${m.add > 0 ? "+" : "−"}${Math.abs(m.add)} %`);
    }
    if (c.tags?.includes(this.flaw.tag)) {
      if (odds === undefined || odds >= 100) {
        odds = this.flaw.certain;
        notes.push(`${this.flaw.label}: ${odds} %`);
      } else {
        odds += this.flaw.add;
        notes.push(`${this.flaw.label} −${Math.abs(this.flaw.add)} %`);
      }
    }
    const view: ChoiceView = { id: c.id, label: this.render(c.label, active, false), notes };
    if (odds !== undefined && odds < 100) view.odds = clamp(odds, 5, 95);
    if (c.cast) {
      const role = this.person(c.cast, active);
      if (role) view.cast = { name: this.members[role].name, relLabel: this.relLabel(role)[0] };
    }
    if (c.career) view.expertise = true;
    if (c.tags?.includes("lie")) view.mayBecomeSecret = true;
    return view;
  }

  // ------------------------------------------------------------------ effects

  private change(text: string, tone: LifeChange["tone"]): void {
    this.changes.push({ text, tone });
  }

  private moment(text: string, roles: CastRole[] = []): void {
    this.state.moments.push({ age: CHAPTER_AGES[Math.min(this.state.chapter, FINALE_CHAPTER)] as number, text });
    this.state.momentPeople.push({ chapter: this.state.chapter, roles, recalled: false });
  }

  private apply(effects: LifeEffect[], active: Active | null): void {
    const s = this.state;
    const ctx = { target: active?.target, secret: active?.secret };
    const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    for (const e of effects) {
      if ("money" in e) {
        const before = s.money;
        s.money = clamp(s.money + e.money, 0, 200);
        const d = s.money - before;
        if (d !== 0) this.change(`${signed(d)} € money`, d > 0 ? "good" : "bad");
      } else if ("rep" in e) {
        s.rep = clamp(s.rep + e.rep, 0, 100);
        this.change(`${signed(e.rep)} reputation`, e.rep > 0 ? "good" : "bad");
      } else if ("fame" in e) {
        s.fame = clamp(s.fame + e.fame, 0, 10);
        this.change(`${signed(e.fame)} ★ fame`, e.fame > 0 ? "good" : "bad");
      } else if ("rel" in e) {
        const role = this.person(e.rel, active);
        if (!role) continue;
        const before = this.relLabel(role)[0];
        s.rel[role] = clamp(s.rel[role] + e.n, -4, 4);
        if (e.n > 0) s.helped[role]++;
        else s.hurt[role]++;
        const after = this.relLabel(role)[0];
        const name = this.members[role].name;
        this.change(before !== after ? `${name}: ${before} → ${after}` : `${name} ${e.n > 0 ? "likes you more" : "likes you less"}`, e.n > 0 ? "good" : "bad");
      } else if ("job" in e) {
        if (e.job === 0) {
          if (s.jobLevel > 0) this.change(`Lost your job (${this.jobTitle()})`, "bad");
          s.jobLevel = 0;
        } else {
          s.jobLevel = e.job;
          this.change(`New job: ${this.jobTitle()}`, "good");
        }
      } else if ("home" in e) {
        s.home = e.home;
        this.change(`Moved: ${e.home}`, "good");
      } else if ("partner" in e) {
        s.partner = e.partner === "crush";
        if (!s.partner) s.married = false;
        this.change(s.partner ? `Together with ${this.members.crush.name}` : "Single again", s.partner ? "good" : "bad");
      } else if ("marry" in e) {
        s.partner = true;
        s.married = true;
        this.change(`Married to ${this.members.crush.name}`, "good");
      } else if ("kid" in e) {
        s.kids++;
        this.change(s.kids === 1 ? "A baby!" : `Another baby! (${s.kids} kids)`, "good");
      } else if ("flag" in e) {
        if (!s.flags.includes(e.flag)) s.flags.push(e.flag);
      } else if ("unflag" in e) {
        s.flags = s.flags.filter((f) => f !== e.unflag);
      } else if ("secret" in e) {
        const sooner = this.flaw.secretsSooner ?? 0;
        const about = e.secret.about ? this.person(e.secret.about, active) : undefined;
        const text = this.render(e.secret.text, ctx, false);
        s.secrets.push({
          id: e.secret.id,
          text,
          ...(about ? { about } : {}),
          due: s.chapter + Math.max(1, e.secret.years - sooner),
          reveal: { text: this.render(e.secret.reveal.text, ctx, false), emoji: e.secret.reveal.emoji, ...(e.secret.reveal.effects ? { effects: e.secret.reveal.effects } : {}) },
        });
        this.change(`New secret: ${text}`, "warn");
      } else if ("secretClear" in e) {
        if (active?.secret) {
          s.secrets = s.secrets.filter((x) => x !== active.secret);
          this.change("Secret dealt with", "good");
        }
      } else if ("secretDelay" in e) {
        if (active?.secret) {
          active.secret.due += e.secretDelay;
          this.change(`Secret buried for ${e.secretDelay} more turns`, "warn");
        }
      } else if ("secretRevealNow" in e) {
        if (active?.secret) {
          active.secret.due = s.chapter;
          this.change("Your secret is about to come out", "bad");
        }
      } else if ("remember" in e) {
        this.moment(this.render(e.remember, ctx, false), this.rolesIn(e.remember, ctx));
      }
    }
  }

  // ------------------------------------------------------------------ people

  private person(ref: PersonRef, active: Pick<Active, "target" | "secret"> | null | undefined): CastRole | undefined {
    if (ref === "target") return active?.target;
    if (ref === "about") return active?.secret?.about;
    return ref;
  }

  private castHelps(role: CastRole | undefined): boolean {
    if (!role) return false;
    const r = this.state.rel[role];
    if (r >= 1) return true;
    if (r <= -1) return false;
    return this.rngCast.chance(this.members[role].helpsAtZero);
  }

  private relLabel(role: CastRole): [string, CastView["tone"]] {
    const s = this.state;
    const r = s.rel[role];
    if (role === "crush" && s.married) return [s.kids > 0 ? "Your spouse, parent of your kids" : "Your spouse", "pos"];
    if (role === "crush" && s.partner) return ["Your partner", "pos"];
    if (r >= 3) return ["Best friend", "pos"];
    if (r >= 1) return ["Friend", "pos"];
    if (r === 0) return ["Acquaintance", "neu"];
    if (r >= -2) return ["Annoyed with you", "neg"];
    return ["Enemy", "neg"];
  }

  private castViews(): CastView[] {
    return CAST_ROLES.map((role) => {
      const m = this.members[role];
      const [relLabel, tone] = this.relLabel(role);
      return { role, id: m.id, name: m.name, trait: m.trait, color: m.color, rel: this.state.rel[role], relLabel, tone };
    });
  }

  // ------------------------------------------------------------------ conditions and text

  private jobTitle(): string {
    return this.state.jobLevel === 0 ? "No job" : this.career.jobs[this.state.jobLevel - 1]!;
  }

  stat(name: LifeStat, target?: CastRole): number {
    const s = this.state;
    const rels = CAST_ROLES.map((r) => s.rel[r]);
    switch (name) {
      case "money":
      case "rep":
      case "fame":
      case "jobLevel":
      case "kids":
      case "chapter":
      case "exposed":
      case "lies":
        return s[name];
      case "secrets":
        return s.secrets.length;
      case "helped":
        return CAST_ROLES.reduce((a, r) => a + s.helped[r], 0);
      case "hurt":
        return CAST_ROLES.reduce((a, r) => a + s.hurt[r], 0);
      case "relMin":
        return Math.min(...rels);
      case "relMax":
        return Math.max(...rels);
      case "rel.target":
        return target ? s.rel[target] : 0;
      default:
        return s.rel[name.slice(4) as CastRole];
    }
  }

  private cond(c: LifeCond, target?: CastRole): boolean {
    const s = this.state;
    if (c.flags && !c.flags.every((f) => s.flags.includes(f))) return false;
    if (c.notFlags && c.notFlags.some((f) => s.flags.includes(f))) return false;
    for (const [k, r] of Object.entries(c.stats ?? {})) {
      const v = this.stat(k as LifeStat, target);
      if (r.min !== undefined && v < r.min) return false;
      if (r.max !== undefined && v > r.max) return false;
    }
    if (c.partner === "crush" && !s.partner) return false;
    if (c.partner === "none" && s.partner) return false;
    if (c.married !== undefined && c.married !== s.married) return false;
    if (c.homeStart !== undefined && c.homeStart !== (s.home === this.content.startHome)) return false;
    if (c.hasJob !== undefined && c.hasJob !== s.jobLevel > 0) return false;
    if (c.dream && !c.dream.includes(s.setup.dream)) return false;
    if (c.flaw && !c.flaw.includes(s.setup.flaw)) return false;
    if (c.career && !c.career.includes(s.setup.career)) return false;
    if (c.dreamDone !== undefined && c.dreamDone !== (s.dreamDone === true)) return false;
    return true;
  }

  /** Picks the text variant and fills the tokens. A variant marked `callback` counts (once per render). */
  private render(t: LifeText, ctx: { target?: CastRole; secret?: Secret }, countCallbacks = true): string {
    let text: string;
    if (typeof t === "string") text = t;
    else {
      const v = t.find((x) => !x.when || this.cond(x.when, ctx.target)) ?? t[t.length - 1]!;
      if (v.callback && countCallbacks) this.state.callbacks++;
      text = v.text;
    }
    const s = this.state;
    return text.replace(/\{([A-Za-z0-9_.]+)\}/g, (all, tok: string) => {
      const [head, sub] = tok.split(".") as [string, string | undefined];
      const lower = head.toLowerCase();
      if (lower === "friend" || lower === "crush" || lower === "rival" || lower === "target" || lower === "about") {
        const role = lower === "target" ? ctx.target : lower === "about" ? ctx.secret?.about : (lower as CastRole);
        if (!role) return lower === "about" ? "your boss" : "someone";
        const m = this.members[role];
        if (!sub) return m.name;
        const p = m.pronouns === "he" ? { he: "he", him: "him", his: "his" } : { he: "she", him: "her", his: "her" };
        const w = p[sub as "he" | "him" | "his"] ?? sub;
        return head[0] === head[0]!.toUpperCase() ? w[0]!.toUpperCase() + w.slice(1) : w;
      }
      switch (tok) {
        case "name":
          return s.setup.name;
        case "money":
          return String(s.money);
        case "fame":
          return String(s.fame);
        case "rep":
          return String(s.rep);
        case "kids":
          return String(s.kids);
        case "job":
          return this.jobTitle();
        case "job2":
          return this.career.jobs[1];
        case "workplace":
          return this.career.workplace;
        case "home":
          return s.home;
        case "secret":
          return ctx.secret?.text ?? "your secret";
        case "age":
          return String(CHAPTER_AGES[Math.min(s.chapter, FINALE_CHAPTER)]);
        default:
          return all;
      }
    });
  }

  /** The people a text is about (its role tokens). */
  private rolesIn(t: LifeText | undefined, ctx: { target?: CastRole; secret?: Secret }): CastRole[] {
    if (!t) return [];
    const texts = typeof t === "string" ? [t] : t.map((v) => v.text);
    const roles = new Set<CastRole>();
    for (const text of texts)
      for (const m of text.matchAll(/\{([A-Za-z]+)/g)) {
        const tok = (m[1] as string).toLowerCase();
        const role = tok === "target" ? ctx.target : tok === "about" ? ctx.secret?.about : (CAST_ROLES as readonly string[]).includes(tok) ? (tok as CastRole) : undefined;
        if (role) roles.add(role);
      }
    return [...roles];
  }

  /**
   * T22 callbacks: an event with someone in it brings back the last thing you did with them in an
   * earlier chapter ("Vera remembers · 21: Sent Vera to chase a fake tow truck…"). Each memory once.
   */
  private recall(texts: (LifeText | undefined)[], target?: CastRole): Active["recall"] {
    const roles = new Set<CastRole>(target ? [target] : []);
    for (const t of texts) for (const r of this.rolesIn(t, { target })) roles.add(r);
    const s = this.state;
    for (let i = s.moments.length - 1; i >= 0; i--) {
      const mp = s.momentPeople[i]!;
      if (mp.recalled || mp.chapter >= s.chapter) continue;
      const role = mp.roles.find((r) => roles.has(r));
      if (!role) continue;
      mp.recalled = true;
      s.callbacks++;
      const m = this.members[role];
      return { name: m.name, color: m.color, text: `${s.moments[i]!.age}: ${s.moments[i]!.text}` };
    }
    return undefined;
  }

  /** The finale: your life flashes before your eyes — the earliest moments not recalled yet. */
  private flashback(n: number): string[] {
    const s = this.state;
    const out: string[] = [];
    for (let i = 0; i < s.moments.length && out.length < n; i++) {
      const mp = s.momentPeople[i]!;
      if (mp.recalled || mp.chapter >= FINALE_CHAPTER) continue;
      mp.recalled = true;
      s.callbacks++;
      out.push(`${s.moments[i]!.age}: ${s.moments[i]!.text}`);
    }
    return out;
  }

  // ------------------------------------------------------------------ board and recap

  private board(): LifeBoard {
    const s = this.state;
    const ch = Math.min(s.chapter, FINALE_CHAPTER);
    const crush = this.members.crush.name;
    return {
      name: s.setup.name,
      age: CHAPTER_AGES[ch] as number,
      chapter: s.chapter,
      dream: { id: this.dream.id, icon: this.dream.icon, label: this.dream.label, note: this.dream.note },
      flaw: { id: this.flaw.id, icon: this.flaw.icon, label: this.flaw.label, note: this.flaw.note },
      career: { id: this.career.id, icon: this.career.icon, label: this.career.label, color: this.career.color },
      job: s.jobLevel > 0 ? this.jobTitle() : null,
      home: s.home,
      partner: s.married ? `Married to ${crush}` : s.partner ? `With ${crush}` : "Single",
      money: s.money,
      fame: s.fame,
      rep: s.rep,
      kids: s.kids,
      years: [...s.years],
      cast: this.castViews(),
      secrets: s.secrets.map((x) => ({ text: x.text, left: x.due - s.chapter })),
      mood: s.mood,
    };
  }

  private recap(): ChapterRecap {
    const s = this.state;
    const title = this.content.titles.find((t) => !t.when || this.cond(t.when)) ?? this.content.titles[this.content.titles.length - 1]!;
    const years = s.years.filter((y): y is string => !!y);
    const done = s.dreamDone === true;
    return {
      mode: "chapters",
      name: s.setup.name,
      career: this.career.label,
      title: { id: title.id, label: title.label, why: this.render(title.why, {}, false) },
      years,
      dream: { id: this.dream.id, icon: this.dream.icon, label: this.dream.label, done },
      flaw: this.flaw.label,
      moments: [...s.moments],
      people: CAST_ROLES.map((role) => ({
        role,
        name: this.members[role].name,
        color: this.members[role].color,
        relLabel: this.relLabel(role)[0],
        helped: s.helped[role],
        hurt: s.hurt[role],
      })),
      secretsKept: s.secrets.map((x) => x.text),
      factors: s.factors,
      callbacks: s.callbacks,
      share: `My Small Town Life: ${years.join("")}\n“${title.label}” · ${this.dream.label}: ${done ? "✅" : "❌"}`,
    };
  }
}

/** Replays a life from its log; throws if a recorded roll differs (the log does not match the content). */
export function replayLife(content: ChapterContent, log: LifeLogEntry[]): ChapterLife {
  const start = log[0];
  if (!start || start.t !== "start") throw new Error("log does not start with a start entry");
  const life = new ChapterLife(content, start.setup, start.seed);
  for (const e of log.slice(1)) {
    if (e.t === "start") throw new Error("second start entry");
    const err = life.act(e.t === "next" ? { t: "next" } : { t: e.t, id: e.id });
    if (err) throw new Error(`replay: ${err}`);
    const last = life.log[life.log.length - 1]!;
    if (last.t === "choose" && e.t === "choose" && (last.roll !== e.roll || last.ok !== e.ok)) throw new Error(`replay differs at choice ${e.id}`);
  }
  return life;
}

/**
 * A simple bot player for simulations: it leans towards its dream (60 % of the time it takes the dream's
 * card if there is one) and prefers choices that are likely to work.
 */
export function botAction(view: LifeView, dreamFocus: readonly string[], rng: Rng): LifeAction {
  const step = view.step;
  if (step.kind === "focus") {
    const dreamCard = step.cards.find((c) => dreamFocus.includes(c.id));
    if (dreamCard && rng.chance(0.6)) return { t: "focus", id: dreamCard.id };
    return { t: "focus", id: rng.pick(step.cards).id };
  }
  if (step.kind === "event") {
    const c = rng.weighted(step.choices, (x) => (x.odds ?? 100) / 100 + (x.expertise ? 0.5 : 0) + 0.2) ?? step.choices[0]!;
    return { t: "choose", id: c.id };
  }
  return { t: "next" };
}

export function playBotLife(content: ChapterContent, setup: LifeSetup, seed: string): ChapterLife {
  const life = new ChapterLife(content, setup, seed);
  const rng = new Rng(`${seed}/bot`);
  const dream = content.dreams.find((d) => d.id === setup.dream)!;
  for (let i = 0; i < 200 && !life.finished; i++) {
    const err = life.act(botAction(life.view(), dream.focus, rng));
    if (err) throw new Error(`bot: ${err}`);
  }
  if (!life.finished) throw new Error("bot life did not finish");
  return life;
}

/** A readable log of a life (for "Show the full log"). */
export function formatLifeLog(content: ChapterContent, log: LifeLogEntry[]): string {
  const start = log[0];
  if (!start || start.t !== "start") return "";
  const life = new ChapterLife(content, start.setup, start.seed);
  const lines = [`Life of ${start.setup.name} — dream ${start.setup.dream}, flaw ${start.setup.flaw}, job ${start.setup.career} (seed ${start.seed})`];
  for (const e of log.slice(1)) {
    if (e.t === "start") break;
    const before = life.view().step;
    life.act(e.t === "next" ? { t: "next" } : { t: e.t, id: e.id });
    const after = life.view().step;
    if (e.t === "focus") lines.push(`Age ${before.kind === "focus" ? before.age : "?"}: focus ${e.id}`);
    if (e.t === "choose" && before.kind === "event" && after.kind === "outcome") {
      const label = before.choices.find((c) => c.id === e.id)?.label ?? e.id;
      lines.push(`  ${before.title}: “${label}”${after.roll ? ` — rolled ${after.roll.roll} (needed ≤ ${after.roll.odds}): ${after.roll.ok ? "worked" : "failed"}` : ""}`);
      lines.push(`    ${after.emoji} ${after.text}`);
      for (const c of after.changes) lines.push(`    · ${c.text}`);
    }
  }
  const end = life.view().step;
  if (end.kind === "done") lines.push(`Title: ${end.recap.title.label}. Dream: ${end.recap.dream.done ? "came true" : "did not come true"}.`);
  return lines.join("\n");
}
