import { useState } from "react";
import type { Attribute, LifeRecap } from "@lifesim/core";
import { api } from "../api";
import { ATTR_LABELS, GOOD_OUTCOMES, OUTCOME_LABELS, RELATION_LABELS, careerName, clock } from "../format";

export function RecapView({ recap }: { recap: LifeRecap }) {
  return (
    <div className="recap">
      <span className="muted small">Life Recap</span>
      <h1>
        {recap.name}, {careerName(recap.career)}
      </h1>
      <p className="lead">
        {recap.finalStatus === "active" ? "Made it through." : recap.cause ?? recap.finalStatus}
      </p>
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
                {m.choiceLabel && <span className="muted"> — you chose “{m.choiceLabel}”</span>}
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
