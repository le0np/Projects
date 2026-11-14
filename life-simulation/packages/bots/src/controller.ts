/**
 * Rule-based bot (BOT_SYSTEM §2, §6): reads the view, scores choices,
 * applies controlled randomness, and submits through the same interface as a human.
 */
import type { CharacterView, Controller, Decision, Notice, Rng } from "@lifesim/core";
import { BotMemory } from "./memory";
import { TARGETED_MOTIVES, type BotProfile } from "./personality";
import { DEFAULT_WEIGHTS, scoreChoices, softmax, type ChoiceScore, type ScoringWeights } from "./scoring";

export interface DecisionTrace {
  t: number;
  instanceId: string;
  eventId: string;
  scores: (ChoiceScore & { probability: number })[];
  chosen: string;
  temperature: number;
}

export class BotController implements Controller {
  readonly memory = new BotMemory();
  /** Every decision with its utility breakdown, for debugging and balance analysis. */
  readonly traces: DecisionTrace[] = [];
  private selfId: string | undefined;

  constructor(
    readonly profile: BotProfile,
    private readonly rng: Rng,
    private readonly weights: ScoringWeights = DEFAULT_WEIGHTS,
  ) {}

  decide(view: CharacterView): Decision | null {
    this.selfId = view.self.id;
    this.bindMotiveTargets(view);
    const scores = scoreChoices(view, this.profile, this.memory, this.weights);
    const temperature = this.weights.temperatureBase + this.weights.temperatureSpan * (this.profile.personality.impulsiveness / 100);
    const probabilities = softmax(
      scores.map((s) => s.utility),
      temperature,
    );
    const index = Math.max(0, this.rng.weightedIndex(probabilities));
    const chosen = scores[index] as ChoiceScore;
    this.traces.push({
      t: view.now,
      instanceId: view.offer.instanceId,
      eventId: view.offer.eventId,
      scores: scores.map((s, i) => ({ ...s, probability: probabilities[i] as number })),
      chosen: chosen.choiceId,
      temperature,
    });
    return { choiceId: chosen.choiceId, thinkMs: this.thinkTime(view) };
  }

  /** Free time follows personality: impulsive and aggressive → bar, cautious → home/park, social → café. */
  chooseLeisure(options: readonly string[]): string | undefined {
    const p = this.profile.personality;
    const weight: Record<string, number> = {
      cafe: 20 + p.empathy * 0.4 + p.trusting * 0.3,
      bar: 10 + p.impulsiveness * 0.5 + p.aggression * 0.3 + p.riskTolerance * 0.2,
      park: 15 + p.caution * 0.3 + p.empathy * 0.2,
      shop: 15 + p.selfishness * 0.3 + p.ambition * 0.2,
      home: 15 + p.caution * 0.5 + (100 - p.impulsiveness) * 0.2,
    };
    return this.rng.weighted([...options], (o) => weight[o] ?? 10);
  }

  observe(notice: Notice): void {
    this.memory.observe(notice, this.selfId);
    if (notice.kind === "resolved") this.updateRevenge();
  }

  /** Impulsive bots answer fast, cautious ones use more of the deadline. */
  private thinkTime(view: CharacterView): number {
    const window = view.offer.deadlineAt - view.now;
    const share = 0.15 + 0.5 * (1 - this.profile.personality.impulsiveness / 100);
    return Math.round(Math.min(window * 0.9, window * share * this.rng.range(0.6, 1.2)));
  }

  /** Targeted motives pick their target from what the bot can see. */
  private bindMotiveTargets(view: CharacterView): void {
    const alive = view.others.filter((o) => o.status === "active");
    if (alive.length === 0) return;
    for (const m of this.profile.motives) {
      if (!TARGETED_MOTIVES.has(m.type) || m.type === "revenge") continue;
      const current = alive.find((o) => o.id === m.targetId);
      if (current) continue;
      if (m.type === "gain_trust") {
        m.targetId = this.rng.pick(alive).id;
      } else {
        // protect_friend / preserve_relationship: the closest person.
        const best = [...alive].sort(
          (a, b) => b.relation.affinity + this.memory.feelingAbout(b.id) - (a.relation.affinity + this.memory.feelingAbout(a.id)) || a.id.localeCompare(b.id),
        )[0];
        if (best && best.relation.affinity + this.memory.feelingAbout(best.id) > 0) m.targetId = best.id;
      }
    }
  }

  /** Grudges can turn into a revenge motive, more easily for aggressive, less loyal bots. */
  private updateRevenge(): void {
    const p = this.profile.personality;
    const threshold = 20 + (100 - p.aggression) * 0.4;
    const target = this.memory.grudges(threshold)[0];
    if (!target) return;
    const existing = this.profile.motives.find((m) => m.type === "revenge");
    if (existing) existing.targetId ??= target;
    else if (p.aggression >= 40) this.profile.motives.push({ type: "revenge", strength: 0.5, targetId: target });
  }
}
