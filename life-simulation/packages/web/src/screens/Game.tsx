import { useEffect, useState } from "react";
import type { Attribute, Notice, OfferView } from "@lifesim/core";
import { ATTR_LABELS, RELATION_LABELS, careerName, clock, hints } from "../format";
import type { GameState } from "../useGame";

const SEASON_LABELS: Record<string, string> = { spring: "🌱 Spring", summer: "☀ Summer", autumn: "🍂 Autumn", winter: "❄ Winter" };

function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface Props {
  game: GameState;
  connected: boolean;
  decide: (choiceId: string) => Promise<{ ok: boolean; reason?: string } | undefined>;
}

export function GameScreen({ game, connected, decide }: Props) {
  const now = useNow();
  const me = game.roster.find((r) => r.characterId === game.characterId);
  const sessionTime = game.sync.sessionTime + (now - game.sync.wall) * game.timeScale;
  const progress = Math.min(1, sessionTime / (game.durationSeconds * 1000));
  const lastResolved = [...game.history].reverse().find((n): n is Extract<Notice, { kind: "resolved" }> => n.kind === "resolved");
  const recentOutcomes = game.history.filter((n): n is Extract<Notice, { kind: "resolved" }> => n.kind === "resolved").slice(-6).reverse();

  return (
    <main className="game">
      <header className="game-header card">
        <div className="who">
          <strong>{me?.name ?? "You"}</strong>
          <span className="muted">{me ? careerName(me.career) : ""}</span>
          {game.calendar && (
            <span className="chip">
              {SEASON_LABELS[game.calendar.season] ?? game.calendar.season} · year {game.calendar.year + 1}
              {game.ageBase && ` · age ${game.ageBase.age + game.calendar.year - game.ageBase.year}`}
            </span>
          )}
          {!connected && <span className="chip bad">Reconnecting…</span>}
        </div>
        <div className="session-clock" aria-label="Session time">
          <div className="bar">
            <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="muted">
            {clock(sessionTime)} / {clock(game.durationSeconds * 1000)}
          </span>
        </div>
        {game.attrs && <Attributes attrs={game.attrs} />}
      </header>

      {game.ended && (
        <div className="banner" role="status">
          Your story has ended — <strong>{game.ended.status}</strong>: {game.ended.cause}. You can watch the rest of the session.
        </div>
      )}

      <div className="game-grid">
        <section className="stage">
          {game.pending ? (
            <EventCard offer={game.pending} game={game} now={now} decide={decide} />
          ) : lastResolved ? (
            <OutcomeCard notice={lastResolved} waiting={!game.ended} />
          ) : (
            <div className="card quiet">
              <p className="muted">Life goes on. Something will happen soon…</p>
            </div>
          )}

          {recentOutcomes.length > 1 && (
            <div className="card">
              <h2>Your story so far</h2>
              <ul className="story">
                {recentOutcomes.slice(1).map((n) => (
                  <li key={n.instanceId}>
                    <strong>{n.title}.</strong> {n.outcomeText ?? ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="side">
          <div className="card">
            <h2>People</h2>
            <ul className="people">
              {game.roster
                .filter((r) => r.characterId !== game.characterId)
                .map((r) => {
                  const o = game.others.find((x) => x.id === r.characterId);
                  return (
                    <li key={r.characterId} className={o && o.status !== "active" ? "gone" : ""}>
                      <span>
                        {r.name} <span className="muted">· {careerName(r.career)}</span>
                      </span>
                      <span className={`chip rel-${o?.relation.type ?? "stranger"}`}>
                        {o && o.status !== "active" ? o.status : RELATION_LABELS[o?.relation.type ?? "stranger"]}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
          <div className="card">
            <h2>Around town</h2>
            <ul className="feed" aria-live="polite">
              {[...game.feed].reverse().filter((f) => f.kind !== "season").slice(0, 12).map((f, i) =>
                f.kind === "event" ? (
                  <li key={`${f.instanceId}-${i}`}>
                    <strong>{f.title}</strong> — {f.text}
                  </li>
                ) : (
                  <li key={`${f.characterId}-${i}`} className="ended">
                    {f.name}: {f.status}. {f.cause}
                  </li>
                ),
              )}
              {game.feed.length === 0 && <li className="muted">Quiet so far.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Attributes({ attrs }: { attrs: Record<Attribute, number> }) {
  return (
    <ul className="attrs">
      {(Object.keys(ATTR_LABELS) as Attribute[]).map((a) => (
        <li key={a} title={`${ATTR_LABELS[a].label}: ${attrs[a]}`}>
          <span className="attr-label">
            {ATTR_LABELS[a].icon} {ATTR_LABELS[a].label}
          </span>
          <span className="meter" role="meter" aria-valuenow={attrs[a]} aria-valuemin={0} aria-valuemax={100} aria-label={ATTR_LABELS[a].label}>
            <span className={`meter-fill ${attrs[a] < 30 ? "low" : ""}`} style={{ width: `${attrs[a]}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function EventCard({ offer, game, now, decide }: { offer: OfferView; game: GameState; now: number; decide: Props["decide"] }) {
  const totalMs = (offer.deadlineAt - offer.offeredAt) / game.timeScale;
  const leftMs = Math.max(0, totalMs - (now - game.pendingReceivedAt));
  const nameOfRole = (role: string) =>
    offer.participants
      .filter((p) => p.role === role)
      .map((p) => p.name)
      .join(" & ") || role;
  const others = offer.participants.filter((p) => p.characterId !== game.characterId);

  return (
    <article className="card event" aria-labelledby="event-title">
      <div className="event-meta">
        <span className={`chip cat-${offer.category}`}>{offer.category}</span>
        {offer.importance === "important" && <span className="chip risk">Important</span>}
        <span className="countdown" aria-label="Time left">
          {Math.ceil(leftMs / 1000)}s
        </span>
      </div>
      <div className="bar thin">
        <div className="bar-fill urgent" style={{ width: `${(leftMs / totalMs) * 100}%` }} />
      </div>
      <h1 id="event-title">{offer.title}</h1>
      <p className="lead">{offer.publicText}</p>
      {offer.privateText && (
        <p className="private">
          <span className="private-label">Only you know</span>
          {offer.privateText}
        </p>
      )}
      {others.length > 0 && <p className="muted small">With: {others.map((o) => o.name).join(", ")}</p>}

      {game.submitted ? (
        <p className="waiting" aria-live="polite">
          You chose “{offer.choices.find((c) => c.id === game.submitted)?.label}”. Waiting for the others…
        </p>
      ) : (
        <ul className="choices">
          {offer.choices.map((c) => (
            <li key={c.id}>
              <button className={c.special ? "choice special" : "choice"} onClick={() => decide(c.id)}>
                <span className="choice-label">
                  {c.special && <span className="special-tag">Your expertise</span>}
                  {c.label}
                </span>
                {c.note && <span className="insight">{c.note}</span>}
                <span className="hints">
                  {hints(c.perceived, nameOfRole).map((h) => (
                    <span key={h.text} className={`hint ${h.tone}`}>
                      {h.text}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">If you do not choose in time: “{offer.choices.find((c) => c.isDefault)?.label}”.</p>
    </article>
  );
}

function OutcomeCard({ notice, waiting }: { notice: Extract<Notice, { kind: "resolved" }>; waiting: boolean }) {
  const changes = Object.entries(notice.selfChanges) as [Attribute, number][];
  return (
    <article className="card outcome" aria-live="polite">
      <span className="muted small">What happened</span>
      <h1>{notice.title}</h1>
      {notice.myChoice && (
        <p className="muted">
          {notice.myChoice.defaulted ? "You did not decide in time: " : "You chose: "}“{notice.myChoice.label}”
        </p>
      )}
      {notice.outcomeText && <p className="lead">{notice.outcomeText}</p>}
      {notice.revealed.length > 0 && (
        <ul className="revealed">
          {notice.revealed.map((r) => (
            <li key={r.characterId}>
              {notice.participants.find((p) => p.characterId === r.characterId)?.name ?? r.characterId} chose “{r.label}”
            </li>
          ))}
        </ul>
      )}
      {changes.length > 0 && (
        <p className="hints">
          {changes.map(([a, d]) => (
            <span key={a} className={`hint ${d > 0 ? "good" : "bad"}`}>
              {ATTR_LABELS[a].icon} {ATTR_LABELS[a].label} {d > 0 ? "+" : ""}
              {d}
            </span>
          ))}
        </p>
      )}
      {waiting && <p className="muted small">Life goes on…</p>}
    </article>
  );
}
