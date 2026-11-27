/**
 * T8: pranks become schemes in three steps.
 *   1. Plan: pick a victim and a scheme; the odds (chance it works, risk you are found out) update live.
 *   2. Prepare: 1–2 years of the life calendar, with ONE boost: cover your tracks, wait for the right
 *      moment, or ask someone to help (they may say yes, no — or warn your victim).
 *   3. Carry out: the result arrives as a note here; the victim only sees what happened to them,
 *      unless they caught you.
 */
import { useEffect, useState } from "react";
import type { Notice, SchemeBoost, SchemeView } from "@lifesim/core";
import type { GameState } from "../useGame";

type Preview = { ok: true; success: number; risk: number; free: boolean } | { ok: false; reason: string } | undefined;

interface Props {
  game: GameState;
  sessionTime: number;
  plan: (mischiefId: string, targetId: string) => Promise<{ ok: boolean; reason?: string } | undefined>;
  preview: (mischiefId: string, targetId: string) => Promise<Preview>;
  boost: (schemeId: string, boost: SchemeBoost, accompliceId?: string) => Promise<{ ok: boolean; reason?: string } | undefined>;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function Schemes({ game, sessionTime, plan, preview, boost }: Props) {
  const m = game.mischief!;
  const alive = (id: string) => (game.others.find((o) => o.id === id)?.status ?? "active") === "active";
  const nameOf = (id: string) => game.roster.find((r) => r.characterId === id)?.name ?? id;
  const targets = game.roster.filter((r) => r.characterId !== game.characterId && alive(r.characterId));
  const revenge = (m.revengeOn ?? []).filter(alive);
  const [target, setTarget] = useState(revenge[0] ?? targets[0]?.characterId ?? "");
  const [kind, setKind] = useState(m.options[0]?.id ?? "");
  const [odds, setOdds] = useState<Preview>(undefined);
  const [msg, setMsg] = useState<string | null>(null);

  // Step 1: the odds follow what you pick.
  useEffect(() => {
    let live = true;
    if (!target || !kind) return setOdds(undefined);
    void preview(kind, target).then((p) => live && setOdds(p));
    return () => {
      live = false;
    };
  }, [kind, target, preview, m.charges, m.schemes?.length]);

  // T8b S1: schemes already used on this victim (by you, or found out from the server) are crossed out,
  // and the selection moves on to one that is still possible.
  const [usedElsewhere, setUsedElsewhere] = useState<Record<string, string[]>>({});
  const used = new Set([...(m.schemes ?? []).filter((s) => s.targetId === target).map((s) => s.mischiefId), ...(usedElsewhere[target] ?? [])]);
  useEffect(() => {
    if (odds && !odds.ok && odds.reason === "they already had this one" && !(usedElsewhere[target] ?? []).includes(kind)) {
      setUsedElsewhere((u) => ({ ...u, [target]: [...(u[target] ?? []), kind] }));
    }
  }, [odds, target, kind, usedElsewhere]);
  useEffect(() => {
    if (kind && used.has(kind)) {
      const next = m.options.find((o) => !used.has(o.id));
      if (next) setKind(next.id);
    }
  }, [kind, target, m.schemes?.length, usedElsewhere]); // eslint-disable-line react-hooks/exhaustive-deps

  const schemes = [...(m.schemes ?? [])].reverse();
  const preparing = schemes.filter((s) => s.state === "preparing");
  const done = schemes.filter((s) => s.state === "done");
  const news = game.history.filter((n): n is Extract<Notice, { kind: "scheme" }> => n.kind === "scheme").slice(-3).reverse();
  const canPlan = odds?.ok === true && (m.charges > 0 || odds.free);

  return (
    <div className="card schemes">
      <h2>
        Schemes <span className="muted small">· {m.charges} left · secret until the end</span>
      </h2>

      {revenge.length > 0 && (
        <p className="revenge small" role="status">
          You caught {revenge.map(nameOf).join(" and ")}. Your revenge is free.
        </p>
      )}

      <div className="scheme-plan">
        <label className="small muted" htmlFor="scheme-target">
          Victim
        </label>
        <select id="scheme-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          {targets.map((t) => (
            <option key={t.characterId} value={t.characterId}>
              {t.name}
              {revenge.includes(t.characterId) ? " (revenge)" : ""}
            </option>
          ))}
        </select>
        <div className="prank-list" role="radiogroup" aria-label="Scheme">
          {m.options.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={o.id === kind}
              disabled={used.has(o.id)}
              className={`ghost prank${o.id === kind ? " active" : ""}${o.career ? " special" : ""}${used.has(o.id) ? " used" : ""}`}
              title={used.has(o.id) ? `${nameOf(target)} already got this one` : o.description}
              onClick={() => setKind(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {odds?.ok ? (
          <p className="odds">
            <span className="odd good">{pct(odds.success)} it works</span>
            <span className="odd bad">{pct(odds.risk)} they find out</span>
            {odds.free && <span className="odd free">free: revenge</span>}
          </p>
        ) : odds ? (
          <p className="small muted">
            {odds.reason === "they already had this one"
              ? `${nameOf(target)} already got this one, pick another scheme.`
              : m.options.every((o) => used.has(o.id))
                ? `You have tried everything on ${nameOf(target)}. Pick someone else.`
                : `Not possible: ${odds.reason}`}
          </p>
        ) : null}
        <button
          className="primary"
          disabled={!canPlan}
          onClick={async () => {
            const r = await plan(kind, target);
            setMsg(r?.ok ? null : `Not possible: ${r?.reason ?? "try again"}`);
          }}
        >
          Start planning
        </button>
      </div>

      {preparing.map((s) => (
        <Preparing key={s.id} s={s} game={game} sessionTime={sessionTime} nameOf={nameOf} boost={boost} />
      ))}

      {news.length > 0 && (
        <ul className="scheme-news small" aria-live="polite">
          {news.map((n, i) => (
            <li key={`${n.scheme.id}-${n.t}-${i}`}>{n.text}</li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <ul className="scheme-done small muted">
          {done.map((s) => (
            <li key={s.id}>
              {s.label} on {nameOf(s.targetId)}: {s.result === "worked" ? "it worked" : "it failed"}
              {s.discovered ? ", and they know it was you" : ""}.
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

/** Step 2: a scheme being prepared, with its progress and the one boost. */
function Preparing({ s, game, sessionTime, nameOf, boost }: { s: SchemeView; game: GameState; sessionTime: number; nameOf: (id: string) => string; boost: Props["boost"] }) {
  const helpers = game.roster.filter((r) => r.characterId !== game.characterId && r.characterId !== s.targetId && (game.others.find((o) => o.id === r.characterId)?.status ?? "active") === "active");
  const [helper, setHelper] = useState(helpers[0]?.characterId ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const progress = Math.min(1, Math.max(0, (sessionTime - s.startedAt) / Math.max(1, s.readyAt - s.startedAt)));
  const run = async (b: SchemeBoost, accompliceId?: string) => {
    const r = await boost(s.id, b, accompliceId);
    setMsg(r?.ok ? null : `Not possible: ${r?.reason ?? "try again"}`);
  };
  return (
    <section className="scheme" aria-label={`${s.label} on ${nameOf(s.targetId)}`}>
      <p className="small">
        <strong>{s.label}</strong> on {nameOf(s.targetId)} · {pct(s.success)} it works · {pct(s.risk)} they find out
      </p>
      <div className="bar thin" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Preparation">
        <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {s.boost ? (
        <p className="small muted">
          {s.boost === "cover" ? "You covered your tracks." : s.boost === "wait" ? "You are waiting for the right moment." : `You asked ${nameOf(s.accomplice ?? "")} for help${s.accompliceAnswer ? ` (${s.accompliceAnswer === "helped" ? "they are in" : s.accompliceAnswer === "refused" ? "they said no" : "they said yes"})` : "…"}.`}
        </p>
      ) : (
        <div className="boosts">
          <span className="small muted">One thing you can do meanwhile:</span>
          <button className="ghost prank" onClick={() => run("cover")} title="Halves the risk of being found out">
            Cover your tracks
          </button>
          <button className="ghost prank" onClick={() => run("wait")} title="+15 % chance it works, but it takes longer">
            Wait for the right moment
          </button>
          <span className="accomplice">
            <select aria-label="Accomplice" value={helper} onChange={(e) => setHelper(e.target.value)}>
              {helpers.map((h) => (
                <option key={h.characterId} value={h.characterId}>
                  {h.name}
                </option>
              ))}
            </select>
            <button className="ghost prank" disabled={!helper} onClick={() => run("accomplice", helper)} title="+25 % if they help. They may also refuse, or warn your victim.">
              Ask for help
            </button>
          </span>
        </div>
      )}
      {msg && <p className="small muted">{msg}</p>}
    </section>
  );
}
