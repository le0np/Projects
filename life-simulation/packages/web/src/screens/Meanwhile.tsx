/**
 * T9: things to do while you wait.
 *   - Guess what someone in another event will choose; right guesses add up (Town Oracle).
 *   - Click someone on the map: who they are, how you stand, their mood, what they are up to.
 */
import type { Notice } from "@lifesim/core";
import { RELATION_LABELS, careerName, quoted } from "../format";
import { MOOD_EMOJI } from "../town/Town";
import type { GameState } from "../useGame";

const MOOD_WORD: Record<string, string> = {
  content: "fine",
  happy: "happy",
  angry: "angry",
  sad: "sad",
  shocked: "shaken",
  in_love: "in love",
  in_debt: "in debt",
  sick: "unwell",
  stressed: "stressed",
};

export function GuessCard({ game, sessionTime, now, guess }: { game: GameState; sessionTime: number; now: number; guess: (instanceId: string, deciderId: string, choiceId: string) => void }) {
  const open = [...game.guessables].reverse().find((g) => g.deadlineAt > sessionTime);
  const last = [...game.history].reverse().find((n): n is Extract<Notice, { kind: "guess_result" }> => n.kind === "guess_result");
  const lastFresh = last && sessionTime - last.t < 8000 * game.timeScale;
  if (game.ended || game.pending || (!open && !lastFresh)) return null;
  const mine = open ? game.guessed[open.instanceId] : undefined;
  void now;
  return (
    <div className="card guess" aria-live="polite">
      <h2>
        Meanwhile <span className="muted small">· Town Oracle {game.oracle.correct}/{game.oracle.guesses}</span>
      </h2>
      {lastFresh && last && (
        <p className={`guess-result ${last.correct ? "good" : "bad"}`}>
          {last.correct ? `✓ Right! ${last.name} chose ${quoted(last.actual)}.` : `✗ ${last.name} chose ${quoted(last.actual)}, not ${quoted(last.guessed)}.`}
        </p>
      )}
      {open && (
        <>
          <p className="small">
            What will <strong>{open.name}</strong> do? <span className="muted">({open.title})</span>
          </p>
          {mine ? (
            <p className="small muted">You think: {quoted(open.choices.find((c) => c.id === mine)?.label)}. Let's see…</p>
          ) : (
            <div className="prank-list">
              {open.choices.map((c) => (
                <button key={c.id} className="ghost prank" onClick={() => guess(open.instanceId, open.deciderId, c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Where someone is and what they are doing, from what the client knows (events, walks, places). */
function doingNow(game: GameState, id: string, sessionTime: number, places: { id: string; name: string }[]): string {
  const other = game.others.find((o) => o.id === id);
  if (other && other.status !== "active") return other.status === "dead" ? "Gone. Flowers by their door." : `In ${other.status === "imprisoned" ? "prison" : "hospital"}.`;
  const event = [...game.feed].reverse().find((f) => f.kind === "event" && sessionTime - f.t < 15000 * game.timeScale && f.participants.some((p) => p.characterId === id));
  if (event && event.kind === "event") return `Busy: ${event.title}.`;
  const walk = game.walks[id];
  const place = walk?.to ? places.find((p) => p.id === walk.to)?.name : undefined;
  const moving = !!walk?.trip && walk.trip.departAt + walk.trip.path.length * walk.trip.msPerTile > sessionTime;
  if (moving) return place ? `On the way to ${place}.` : "Walking around town.";
  return place ? `At ${place}.` : "Taking it easy.";
}

export function PersonCard({ game, id, sessionTime, places, close }: { game: GameState; id: string; sessionTime: number; places: { id: string; name: string }[]; close: () => void }) {
  const r = game.roster.find((x) => x.characterId === id);
  if (!r) return null;
  const me = id === game.characterId;
  const o = game.others.find((x) => x.id === id);
  const mood = game.moods[id] ?? "content";
  return (
    <div className="card person" role="dialog" aria-label={`About ${r.name}`}>
      <button className="ghost close" onClick={close} aria-label="Close">
        ×
      </button>
      <p className="person-name">
        <strong>{me ? `${r.name} (you)` : r.name}</strong> <span className="muted">· {careerName(r.career)}</span>
      </p>
      {r.trait && <p className="trait">{r.trait}</p>}
      {!me && o && (
        <p className="small">
          {RELATION_LABELS[o.relation.type]}
          {o.debt === "owes_you" ? " · owes you money" : o.debt === "you_owe" ? " · you owe them money" : o.debt === "both" ? " · you owe each other" : ""}
        </p>
      )}
      <p className="small">
        {MOOD_EMOJI[mood]} {MOOD_WORD[mood] ?? mood} · {doingNow(game, id, sessionTime, places)}
      </p>
    </div>
  );
}
