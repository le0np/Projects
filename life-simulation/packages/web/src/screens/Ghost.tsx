/**
 * T12: after your story ends (dead or in prison) you haunt the town: push fate once per decade,
 * vote for the Gossip of the Year, and leave a one-sentence will read out in everyone's recap.
 */
import { useState } from "react";
import type { Notice } from "@lifesim/core";
import type { GameState } from "../useGame";

export function GhostCard({ game, sessionTime, act }: { game: GameState; sessionTime: number; act: (action: "nudge" | "vote" | "will", target: string) => Promise<{ ok: boolean; reason?: string } | undefined> }) {
  const g = game.ghost!;
  const [will, setWill] = useState(g.wills[0] ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const open = [...game.guessables].reverse().filter((x) => x.deadlineAt > sessionTime).slice(0, 3);
  const gossip = [...game.feed]
    .reverse()
    .filter((f): f is Extract<GameState["feed"][number], { kind: "event" }> => f.kind === "event" && f.participants.length >= 2)
    .slice(0, 5);
  const last = [...game.history].reverse().find((n): n is Extract<Notice, { kind: "ghost" }> => n.kind === "ghost" && !!n.text);
  const run = async (action: "nudge" | "vote" | "will", target: string) => {
    const r = await act(action, target);
    setMsg(r?.ok ? null : `Not possible: ${r?.reason ?? "try again"}`);
  };
  return (
    <div className="card ghost-card">
      <h2>
        👻 You are a ghost <span className="muted small">· {g.nudgesLeft} push{g.nudgesLeft === 1 ? "" : "es"} left</span>
      </h2>
      {last?.text && <p className="small muted">{last.text}</p>}

      <h3>Push fate</h3>
      {open.length === 0 ? (
        <p className="small muted">Nothing is happening right now. Wait for someone else's moment.</p>
      ) : (
        <div className="prank-list">
          {open.map((o) => (
            <button key={o.instanceId} className="ghost prank" disabled={g.nudgesLeft <= 0} title="+10 % to the first outcome left to chance" onClick={() => run("nudge", o.instanceId)}>
              Push fate: {o.title}
            </button>
          ))}
        </div>
      )}

      <h3>Gossip of the Year</h3>
      {gossip.length === 0 ? (
        <p className="small muted">Nothing worth gossiping about yet.</p>
      ) : (
        <div className="prank-list" role="radiogroup" aria-label="Gossip of the Year">
          {gossip.map((f) => (
            <button key={f.instanceId} role="radio" aria-checked={g.votedFor === f.instanceId} className={`ghost prank${g.votedFor === f.instanceId ? " active" : ""}`} onClick={() => run("vote", f.instanceId)}>
              {f.title}
            </button>
          ))}
        </div>
      )}

      <h3>Your will</h3>
      {g.will ? (
        <p className="small">“{g.will}” <span className="muted">(read out at the end)</span></p>
      ) : null}
      <select aria-label="Your will" value={will} onChange={(e) => setWill(e.target.value)}>
        {g.wills.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
      <button className="ghost prank" onClick={() => run("will", will)}>
        {g.will ? "Change your will" : "Leave this will"}
      </button>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
