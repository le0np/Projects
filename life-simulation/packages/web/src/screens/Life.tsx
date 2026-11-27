/**
 * Sprint 5 (T24): "Life in chapters" — the screens of the design prototype in the real game.
 * The server runs the life; this only shows the board and the current step, and sends what you pick.
 * No timers: you read at your own pace and click on.
 */
import { useEffect, useRef, useState } from "react";
import type { ChapterRecap, LifeBoard, LifeStep } from "@lifesim/core";
import { api } from "../api";
import type { LifeState } from "../useGame";
import "./life.css";

type Act = (a: { t: "next" } | { t: "focus" | "choose"; id: string }) => Promise<{ ok: boolean; error?: string } | undefined>;

export interface LifeOptions {
  legacyTown: boolean;
  dreams: { id: string; icon: string; label: string; note: string }[];
  flaws: { id: string; icon: string; label: string; note: string }[];
  careers: { id: string; icon: string; label: string; note: string }[];
}

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The puppet: a bean with a face. */
export function Bean({ color, mood = "ok", size = 56 }: { color: string; mood?: "good" | "ok" | "bad"; size?: number }) {
  const mouth = mood === "good" ? "M18 34 Q28 44 38 34" : mood === "bad" ? "M19 39 Q28 31 37 39" : "M20 36 L36 36";
  return (
    <svg className="bean" width={size} height={size * 1.15} viewBox="0 0 56 64" aria-hidden="true">
      <ellipse cx="28" cy="61" rx="17" ry="3" fill="#000" opacity=".15" />
      <path d="M28 3 C45 3 50 18 50 34 C50 50 43 58 28 58 C13 58 6 50 6 34 C6 18 11 3 28 3Z" fill={color} stroke="#1d2230" strokeWidth="2.5" />
      {mood === "bad" ? (
        <path d="M15 18 L23 21 M41 18 L33 21" stroke="#1d2230" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M15 19 L23 18 M33 18 L41 19" stroke="#1d2230" strokeWidth="3" strokeLinecap="round" />
      )}
      {mood === "good" ? (
        <path d="M17 26 Q20 22 23 26 M33 26 Q36 22 39 26" stroke="#1d2230" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="20" cy="26" r="2.6" fill="#1d2230" />
          <circle cx="36" cy="26" r="2.6" fill="#1d2230" />
        </>
      )}
      <path d={mouth} stroke="#1d2230" strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ------------------------------------------------------------------ character creation (in the lobby)

export function LifeCreate({
  options,
  connected,
  startLife,
}: {
  options: LifeOptions;
  connected: boolean;
  startLife: (s: { name: string; dream: string; flaw: string; career: string }) => Promise<{ ok: boolean; error?: string } | undefined>;
}) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("lifesim.name") ?? "";
    } catch {
      return "";
    }
  });
  const [pick, setPick] = useState<{
    dream?: string;
    flaw?: string;
    career?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOk = /^\p{L}[\p{L} '-]{1,15}$/u.test(name.trim());
  const ready = nameOk && pick.dream && pick.flaw && pick.career;

  const group = (title: string, key: "dream" | "flaw" | "career", list: LifeOptions["dreams"], cls: string) => (
    <>
      <h3>{title}</h3>
      <div className={cls} role="group" aria-label={title}>
        {list.map((o) => (
          <button key={o.id} className="lf-pick" aria-pressed={pick[key] === o.id} onClick={() => setPick((p) => ({ ...p, [key]: o.id }))}>
            <span className="big" aria-hidden="true">
              {o.icon}
            </span>
            <b>{o.label}</b>
            <span className="small muted">{o.note}</span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="lf lf-embedded">
      <section className="lf-card" aria-label="Start a new life">
        <h2>Live a whole life, from 18 to 33</h2>
        <p className="muted">
          About ten minutes. Each turn you choose what your life is about. Three people will be there the whole way, and they remember how you treat them.
        </p>
        <label className="small" htmlFor="life-name">
          <b>Your character's name</b>
        </label>
        <input id="life-name" type="text" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!nameOk} autoComplete="off" />
        {group("Your dream", "dream", options.dreams, "lf-grid3")}
        {group("Your flaw", "flaw", options.flaws, "lf-grid3")}
        {group("Your job", "career", options.careers, "lf-grid5")}
        {error && (
          <p className="lf-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="lf-btn"
          disabled={!ready || !connected || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              localStorage.setItem("lifesim.name", name.trim());
            } catch {
              /* not remembered */
            }
            const r = await startLife({
              name: name.trim(),
              dream: pick.dream!,
              flaw: pick.flaw!,
              career: pick.career!,
            });
            setBusy(false);
            if (!r?.ok) setError(r?.error === "invalid_name" ? "Use 2–16 letters for the name." : "Could not start a life. Try again.");
          }}
        >
          Start your life
        </button>
        {!ready && <p className="small muted">Pick a name, a dream, a flaw and a job.</p>}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ the life

export function LifeScreen({ life, act, leave, token }: { life: LifeState; act: Act; leave: () => Promise<void>; token: string }) {
  const { board, step } = life.view;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (a: Parameters<Act>[0]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await act(a);
    setBusy(false);
    if (!r?.ok) setError(r?.error ?? "Something went wrong. Try again.");
  };
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  }, [step.kind, board.chapter, step.kind === "event" ? step.eventId : ""]);

  return (
    <main className="lf">
      <div className="lf-wrap">
        <div className="lf-top">
          <span>Life in chapters · no timer</span>
          {step.kind !== "done" && (
            <button
              onClick={() => {
                if (window.confirm("Leave this life? It will be lost.")) void leave();
              }}
            >
              Leave this life
            </button>
          )}
        </div>
        {step.kind !== "done" && <Board board={board} />}
        <div key={`${step.kind}-${board.chapter}-${step.kind === "event" ? step.eventId : ""}`} className="lf-fade">
          {step.kind === "intro" && <Intro step={step} onNext={() => run({ t: "next" })} busy={busy} />}
          {step.kind === "focus" && <Focus step={step} onPick={(id) => run({ t: "focus", id })} busy={busy} />}
          {step.kind === "event" && <EventCard step={step} onPick={(id) => run({ t: "choose", id })} busy={busy} />}
          {step.kind === "outcome" && <Outcome step={step} onNext={() => run({ t: "next" })} busy={busy} />}
          {step.kind === "done" && <Done recap={step.recap} lifeId={life.lifeId} token={token} onAgain={leave} />}
        </div>
        {error && (
          <p className="lf-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function Board({ board }: { board: LifeBoard }) {
  const ages = [18, 21, 24, 27, 30, 33];
  return (
    <section className="lf-card" aria-label="Your life">
      <div className="lf-board">
        <Bean color={board.career.color} mood={board.mood} size={64} />
        <div className="lf-who">
          <h2>
            {board.name}, {board.age}
          </h2>
          <p className="small muted">
            Dream:{" "}
            <b>
              {board.dream.icon} {board.dream.label}
            </b>{" "}
            · Flaw:{" "}
            <b>
              {board.flaw.icon} {board.flaw.label}
            </b>
          </p>
          <div className="lf-chips">
            <span className="lf-chip">💼 {board.job ?? "No job"}</span>
            <span className="lf-chip">🏠 {board.home}</span>
            <span className="lf-chip">❤️ {board.partner}</span>
            {board.kids > 0 && <span className="lf-chip">👶 {board.kids}</span>}
            <span className="lf-chip">€ {board.money}</span>
            <span className="lf-chip">★ {board.fame} fame</span>
            <span className="lf-chip">👍 {board.rep} reputation</span>
          </div>
        </div>
      </div>
      <div className="lf-timeline" aria-label="Your life so far">
        {ages.map((a, i) => (
          <span key={a} className={`lf-dot${i < board.chapter ? " done" : i === board.chapter ? " now" : ""}`} title={`Age ${a}`}>
            {i < board.chapter && board.years[i] ? board.years[i] : a}
          </span>
        ))}
      </div>
      <div className="lf-cast">
        {board.cast.map((p) => (
          <div key={p.role} className="lf-person" title={p.trait}>
            <Bean color={p.color} mood={p.rel >= 1 ? "good" : p.rel <= -2 ? "bad" : "ok"} size={34} />
            <div style={{ minWidth: 0 }}>
              <div className="name">{p.name}</div>
              <div className={`rel ${p.tone}`}>{p.relLabel}</div>
            </div>
          </div>
        ))}
      </div>
      {board.secrets.length > 0 && (
        <div className="lf-secrets">
          {board.secrets.map((x, i) => (
            <div key={i} className="lf-secret">
              🤫 <b>Secret:</b> {x.text} · <b>{x.left <= 0 ? "about to come out" : x.left === 1 ? "comes out next time" : `safe for ${x.left} more turns`}</b>
              {board.flaw.id === "blabber" ? " (and you're a blabbermouth)" : ""}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Intro({ step, onNext, busy }: { step: Extract<LifeStep, { kind: "intro" }>; onNext: () => void; busy: boolean }) {
  return (
    <section className="lf-card">
      <p className="lf-eyebrow">Age 18 · the people in your life</p>
      <h2>These three will be there the whole way.</h2>
      <div className="lf-rows">
        {step.cast.map((p) => (
          <div key={p.role} className="lf-row">
            <Bean color={p.color} size={40} />
            <div>
              <b>{p.name}</b> <span className="small muted">· your {p.role === "crush" ? "crush" : p.role === "friend" ? "best friend" : "rival"}</span>
              <p className="small muted">{p.trait}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">They decide on their own: friends help you, people you've hurt get even.</p>
      <button className="lf-btn" onClick={onNext} disabled={busy}>
        Begin
      </button>
    </section>
  );
}

function Focus({ step, onPick, busy }: { step: Extract<LifeStep, { kind: "focus" }>; onPick: (id: string) => void; busy: boolean }) {
  return (
    <section className="lf-card">
      <p className="lf-eyebrow">Age {step.age} · your move</p>
      <h2>What is this part of your life about?</h2>
      <div className="lf-grid3">
        {step.cards.map((c) => (
          <button key={c.id} className="lf-pick" onClick={() => onPick(c.id)} disabled={busy}>
            <span className="big" aria-hidden="true">
              {c.icon}
            </span>
            <b>{c.label}</b>
            <span className="small muted">{c.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EventCard({ step, onPick, busy }: { step: Extract<LifeStep, { kind: "event" }>; onPick: (id: string) => void; busy: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <section className="lf-card" aria-label={step.title}>
      <p className="lf-eyebrow">
        Age {step.age} · {step.focusLabel}
      </p>
      <h2>{step.title}</h2>
      <p className="lf-lead">{step.text}</p>
      {step.private && <p className="lf-private">{step.private}</p>}
      {step.recall && (
        <div className="lf-recall">
          <Bean color={step.recall.color} size={28} />
          <span>
            <b>{step.recall.name} remembers</b> · {step.recall.text}
          </span>
        </div>
      )}
      {step.memories && step.memories.length > 0 && (
        <div className="lf-rows">
          <p className="small">
            <b>Your life flashes before your eyes:</b>
          </p>
          {step.memories.map((m) => (
            <p key={m} className="small muted">
              {m}
            </p>
          ))}
        </div>
      )}
      {step.factors && (
        <div className="lf-factors">
          <p className="small">
            <b>Your whole life comes down to this. Your chances:</b>
          </p>
          {step.factors.map((f) => (
            <div key={f.label}>
              <span>{f.label}</span>
              <b
                style={{
                  color: f.value >= 0 ? "var(--lf-teal)" : "var(--lf-tomato)",
                }}
              >
                {f.value >= 0 ? "+" : ""}
                {f.value} %
              </b>
            </div>
          ))}
        </div>
      )}
      <div className="lf-choices">
        {step.choices.map((c) => (
          <button
            key={c.id}
            className="lf-choice"
            aria-pressed={picked === c.id}
            disabled={busy || picked !== null}
            onClick={() => {
              setPicked(c.id);
              onPick(c.id);
            }}
          >
            <span className="label">{c.label}</span>
            <span className="lf-chips">
              {c.expertise && <span className="lf-chip expert">Your expertise</span>}
              {c.odds !== undefined && <span className={`lf-chip odds ${c.odds >= 60 ? "good" : c.odds >= 40 ? "warn" : "bad"}`}>{c.odds} % it works</span>}
              {c.notes.map((n) => (
                <span key={n} className="lf-chip warn">
                  {n}
                </span>
              ))}
              {c.cast && (
                <span className="lf-chip">
                  {c.cast.name} decides too · {c.cast.relLabel}
                </span>
              )}
              {c.mayBecomeSecret && <span className="lf-chip warn">may become a secret</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The roll is animated first (if there was one), then the outcome. */
function Outcome({ step, onNext, busy }: { step: Extract<LifeStep, { kind: "outcome" }>; onNext: () => void; busy: boolean }) {
  const [phase, setPhase] = useState<"roll" | "shown">(step.roll ? "roll" : "shown");
  const [n, setN] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!step.roll) return;
    const steps = reduced() ? 1 : 14;
    let t = 0;
    const tick = () => {
      t++;
      setN(t >= steps ? step.roll!.roll : 1 + Math.floor(Math.random() * 100));
      if (t < steps) timers.current.push(window.setTimeout(tick, 45 + t * 6));
      else timers.current.push(window.setTimeout(() => setPhase("shown"), reduced() ? 300 : 1100));
    };
    tick();
    return () => timers.current.forEach(clearTimeout);
  }, [step.roll]);

  if (phase === "roll" && step.roll) {
    const done = n === step.roll.roll;
    return (
      <section className="lf-card" aria-label="Rolling">
        <p className="lf-eyebrow">
          {step.title} · {step.choiceLabel}
        </p>
        <div className="lf-roll">
          <span>{n ?? "··"}</span>
          <span className="need">need {step.roll.odds} or less</span>
        </div>
        <p className={`lf-verdict${done ? (step.roll.ok ? " good" : " bad") : ""}`} aria-live="polite">
          {done ? (step.roll.ok ? "It works!" : "It doesn't work.") : ""}
        </p>
        <button className="lf-btn alt" onClick={() => setPhase("shown")}>
          Skip
        </button>
      </section>
    );
  }
  return (
    <section className="lf-card" aria-label="What happened">
      <p className="lf-eyebrow">{step.title}</p>
      <p className="lf-rolled">
        You chose “{step.choiceLabel}”{step.roll ? ` · rolled ${step.roll.roll}, needed ${step.roll.odds} or less` : ""}
      </p>
      {step.cast && (
        <div className="lf-row">
          <Bean color={step.cast.color} mood={step.cast.tone === "good" ? "good" : "bad"} size={36} />
          <div>
            <b>{step.cast.name}</b> {step.cast.did}.
          </div>
        </div>
      )}
      <p className="lf-punch">
        {step.emoji} {step.text}
      </p>
      {step.changes.length > 0 && (
        <div>
          <p className="small">
            <b>What changed</b>
          </p>
          <div className="lf-chips">
            {step.changes.map((c, i) => (
              <span key={i} className={`lf-chip ${c.tone}`}>
                {c.text}
              </span>
            ))}
          </div>
        </div>
      )}
      <button className="lf-btn" onClick={onNext} disabled={busy}>
        {step.next}
      </button>
    </section>
  );
}

function Done({ recap, lifeId, token, onAgain }: { recap: ChapterRecap; lifeId: string; token: string; onAgain: () => Promise<void> }) {
  const [log, setLog] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  return (
    <>
      <section className="lf-card">
        <ChapterRecapView recap={recap} />
        <div className="lf-chips">
          <CopyMyLife text={recap.share} />
          <button className="lf-btn alt" onClick={() => void onAgain()}>
            Live another life
          </button>
          <button
            className="lf-btn alt"
            onClick={async () => {
              try {
                setLog(
                  (
                    await api<{ text: string }>(`/api/sessions/${lifeId}/log`, {
                      token,
                    })
                  ).text,
                );
              } catch {
                setLogError("The full log is not available yet — try again in a moment.");
              }
            }}
          >
            Show the full log
          </button>
        </div>
        {logError && <p className="small lf-error">{logError}</p>}
      </section>
      {log && (
        <section className="lf-card">
          <h2>Life log</h2>
          <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {log}
          </pre>
        </section>
      )}
    </>
  );
}

function CopyMyLife({ text }: { text: string }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <>
      <button
        className="lf-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone("Copied. Paste it in your group chat.");
          } catch {
            setDone(text);
          }
        }}
      >
        Copy my life
      </button>
      {done &&
        (done.startsWith("Copied") ? <span className="small muted">{done}</span> : <textarea readOnly value={done} rows={3} style={{ width: "100%" }} />)}
    </>
  );
}

export function ChapterRecapView({ recap }: { recap: ChapterRecap }) {
  return (
    <div className="lf-rows">
      <p className="lf-eyebrow">
        {recap.name} · {recap.career} · age 18 to 33
      </p>
      <div className="lf-title-big">{recap.title.label}</div>
      <p className="lf-lead">{recap.title.why}</p>
      <div className="lf-emoji-line" aria-label="Your life in emoji">
        {recap.years.join("")}
      </div>
      <p>
        <b>
          {recap.dream.icon} {recap.dream.label}:
        </b>{" "}
        {recap.dream.done ? "it came true." : "it didn't come true."}
      </p>
      {recap.factors.length > 0 && (
        <div className="lf-factors">
          {recap.factors.map((f) => (
            <div key={f.label}>
              <span>{f.label}</span>
              <b>
                {f.value >= 0 ? "+" : ""}
                {f.value} %
              </b>
            </div>
          ))}
        </div>
      )}
      <h3>Your life</h3>
      <ul className="lf-moments">
        {recap.moments.map((m, i) => (
          <li key={i}>
            <b>{m.age}</b> · {m.text}
          </li>
        ))}
      </ul>
      <h3>The people in your life</h3>
      <div className="lf-rows">
        {recap.people.map((p) => (
          <div key={p.role} className="lf-row">
            <Bean color={p.color} size={34} />
            <div>
              <b>{p.name}</b> · {p.relLabel}
              <p className="small muted">
                You helped them {p.helped}×, hurt them {p.hurt}×.
              </p>
            </div>
          </div>
        ))}
      </div>
      {recap.secretsKept.length > 0 && (
        <p className="small">
          <b>Secrets you took to the grave:</b> {recap.secretsKept.join("; ")}.
        </p>
      )}
    </div>
  );
}
