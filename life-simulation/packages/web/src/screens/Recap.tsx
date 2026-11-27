import { useEffect, useState } from "react";
import type { Attribute, LifeRecap } from "@lifesim/core";
import { api } from "../api";
import { ATTR_LABELS, GOOD_OUTCOMES, OUTCOME_LABELS, RELATION_LABELS, careerName, clock, lifeShareText, quoted } from "../format";

export function RecapView({ recap }: { recap: LifeRecap }) {
  return (
    <div className="recap">
      <span className="muted small">Life Recap</span>
      <h1>
        {recap.name}, {careerName(recap.career)}
      </h1>
      {recap.title && (
        <div className="life-title">
          <p className="life-title-label">“{recap.title.label}”</p>
          <p className="muted">{recap.title.why}</p>
          {recap.years && <p className="years" aria-label="Your life, one emoji per year">{recap.years.join("")}</p>}
          <CopyLife recap={recap} />
        </div>
      )}
      <p className="lead">
        {recap.finalStatus === "active" ? "Made it through." : recap.cause ?? recap.finalStatus}
      </p>
      <Reveals recap={recap} />
      <p className="chips">
        {recap.outcomes.map((o) => (
          <span key={o} className={GOOD_OUTCOMES.has(o) ? "chip good" : "chip bad"}>
            {OUTCOME_LABELS[o]}
          </span>
        ))}
      </p>
      <div className="stats">
        <div className="stat">
          <span className="stat-value">{clock(recap.lifeDurationMs)}</span>
          <span className="stat-label">of {clock(recap.sessionDurationMs)} lived</span>
        </div>
        <div className="stat">
          <span className="stat-value">{recap.ageAtEnd ?? "–"}</span>
          <span className="stat-label">years old</span>
        </div>
        <div className="stat">
          <span className="stat-value">{recap.eventsCount}</span>
          <span className="stat-label">events</span>
        </div>
        <div className="stat">
          <span className="stat-value">{recap.lifeScore}</span>
          <span className="stat-label">life score</span>
        </div>
      </div>
      <table className="attr-table">
        <tbody>
          {(Object.keys(ATTR_LABELS) as Attribute[]).map((a) => {
            const d = recap.finalAttrs[a] - recap.startAttrs[a];
            return (
              <tr key={a}>
                <th>
                  {ATTR_LABELS[a].icon} {ATTR_LABELS[a].label}
                </th>
                <td>
                  {recap.startAttrs[a]} → {recap.finalAttrs[a]}
                </td>
                <td className={d > 0 ? "good" : d < 0 ? "bad" : "muted"}>
                  {d > 0 ? "+" : ""}
                  {d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {recap.keyMoments.length > 0 && (
        <>
          <h2>Important moments</h2>
          <ol className="moments">
            {recap.keyMoments.map((m) => (
              <li key={m.instanceId}>
                <strong>{m.eventTitle}</strong>
                {m.choiceLabel && <span className="muted"> — you chose {quoted(m.choiceLabel)}</span>}
                {m.text && <p>{m.text}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
      {(recap.relationshipsGained.length > 0 || recap.relationshipsLost.length > 0) && (
        <>
          <h2>Relationships</h2>
          <ul className="plain">
            {recap.relationshipsGained.map((g) => (
              <li key={`g-${g.characterId}`} className="good">
                + {g.name}: {RELATION_LABELS[g.type]}
              </li>
            ))}
            {recap.relationshipsLost.map((l) => (
              <li key={`l-${l.characterId}`} className="bad">
                − {l.name}: {RELATION_LABELS[l.from]} → {RELATION_LABELS[l.to]}
              </li>
            ))}
          </ul>
        </>
      )}
      {recap.secrets && recap.secrets.played.length > 0 && (
        <>
          <h2>Your schemes</h2>
          <ul className="plain">
            {recap.secrets.played.map((p, i) => (
              <li key={`p-${i}`}>
                You schemed <strong>{p.mischief}</strong> against {p.on}
                {p.boost === "cover" ? ", covered your tracks" : p.boost === "wait" ? ", waited for the right moment" : ""}
                {p.accomplice
                  ? `, asked ${p.accomplice} for help (${p.accompliceAnswer === "helped" ? "they helped" : p.accompliceAnswer === "betrayed" ? "they warned " + p.on : "they said no"})`
                  : ""}
                {p.result === "worked" ? " — and it worked." : p.result === "failed" ? " — and it failed." : "."}
              </li>
            ))}

          </ul>
        </>
      )}
      {recap.goals && recap.goals.length > 0 && (
        <>
          <h2>Your goals</h2>
          <ul className="plain goals-recap">
            {recap.goals.map((g) => (
              <li key={g.id} className={g.done ? "good" : "bad"}>
                {g.done ? "✓" : "✗"} {g.label}
              </li>
            ))}
          </ul>
        </>
      )}
      {recap.town && (recap.town.gossipOfTheYear || recap.town.wills.length > 0) && (
        <>
          <h2>The town remembers</h2>
          {recap.town.gossipOfTheYear && (
            <p>
              🗞️ Gossip of the Year: <strong>{recap.town.gossipOfTheYear.title}</strong>{" "}
              <span className="muted">({recap.town.gossipOfTheYear.votes} ghost vote{recap.town.gossipOfTheYear.votes === 1 ? "" : "s"})</span>
            </p>
          )}
          {recap.town.wills.length > 0 && (
            <ul className="plain wills">
              {recap.town.wills.map((w) => (
                <li key={w.name}>
                  📜 {w.name}'s will: “{w.text}”
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {recap.ghost && <p className="muted">👻 As a ghost you pushed fate {recap.ghost.nudges} time{recap.ghost.nudges === 1 ? "" : "s"}.</p>}
      {recap.oracle && recap.oracle.guesses > 0 && (
        <p className="oracle">
          {recap.oracle.correct >= 3 ? "🔮 Town Oracle: " : "Guesses about other people: "}
          {recap.oracle.correct} of {recap.oracle.guesses} right.
        </p>
      )}
      {recap.influencedBy.length > 0 && (
        <>
          <h2>People who shaped your life</h2>
          <ul className="plain">
            {recap.influencedBy.map((i) => (
              <li key={i.characterId}>
                {i.name} <span className="muted">— {i.events} decisive moment{i.events === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function RecapScreen({ recap, sessionId, token, onBack }: { recap: LifeRecap; sessionId: string; token: string; onBack: () => void }) {
  const [log, setLog] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  async function showLog() {
    try {
      const res = await api<{ text: string }>(`/api/sessions/${sessionId}/log`, { token });
      setLog(res.text);
    } catch {
      setLogError("The full log is not available yet — try again in a moment.");
    }
  }

  return (
    <main className="recap-screen">
      <section className="card">
        <RecapView recap={recap} />
        <div className="play-row">
          <button className="primary" onClick={onBack}>
            Back to the lobby
          </button>
          <button className="ghost" onClick={showLog}>
            Show the full session log
          </button>
        </div>
        {logError && <p className="error">{logError}</p>}
      </section>
      {log && (
        <section className="card">
          <h2>Session log</h2>
          <pre className="log">{log}</pre>
        </section>
      )}
    </main>
  );
}

function CopyLife({ recap }: { recap: LifeRecap }) {
  const [done, setDone] = useState<string | null>(null);
  const text = lifeShareText(recap);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone("Copied!");
    } catch {
      // No clipboard permission: show the text to copy by hand.
      setDone(text);
    }
  };
  return (
    <p className="copy-life">
      <button className="ghost" onClick={copy}>
        Copy my life
      </button>{" "}
      {done && (done === "Copied!" ? <span className="muted small">{done}</span> : <textarea readOnly className="share-text" value={done} rows={3} />)}
    </p>
  );
}

/**
 * T11: the recap opens with the secrets, one at a time: the question first ("Who was behind
 * “Let their tyres down” in year 3?"), a pause, then the answer.
 */
function Reveals({ recap }: { recap: LifeRecap }) {
  const items = (recap.secrets?.suffered ?? []).map((p) => ({
    question: `Who was behind ${quoted(p.mischief)}${p.year !== undefined ? ` in year ${p.year + 1}` : ""}?`,
    answer: `${p.by}${p.discovered ? " (and you caught them)" : ""}.`,
  }));
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduce ? items.length * 2 : 0);
  useEffect(() => {
    if (shown >= items.length * 2) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown % 2 === 0 ? 700 : 1600);
    return () => clearTimeout(t);
  }, [shown, items.length]);
  if (items.length === 0) return null;
  return (
    <section className="reveals" aria-live="polite">
      <h2>Secrets revealed</h2>
      <ul className="plain">
        {items.map((it, i) =>
          shown > i * 2 ? (
            <li key={i}>
              <span>{it.question}</span> {shown > i * 2 + 1 ? <strong className="reveal-answer">{it.answer}</strong> : <span className="muted">…</span>}
            </li>
          ) : null,
        )}
      </ul>
      {shown < items.length * 2 && (
        <button className="ghost small" onClick={() => setShown(items.length * 2)}>
          Show all
        </button>
      )}
    </section>
  );
}
