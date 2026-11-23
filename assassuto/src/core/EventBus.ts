/** Typed publish/subscribe bus. Gameplay systems talk through events instead of direct references. */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of [...set]) (h as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Events used by the game. Extend as systems are added. */
export type GameEvents = {
  regionEntered: { regionId: string };
  playerLanded: { fallSpeed: number };
  playerJumped: Record<string, never>;
  assetFallback: { assetId: string; reason: string };
  hit: { attacker: string; target: string; damage: number };
  parry: { enemy: string };
  enemyKilled: { id: string; xp: number };
  playerDied: Record<string, never>;
  abilityCast: { element: string };
  spearPickedUp: Record<string, never>;
  discovered: { id: string; name: string };
  elementUnlocked: { element: string };
};
