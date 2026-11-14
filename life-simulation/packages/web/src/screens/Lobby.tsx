import { useEffect, useState } from "react";
import type { LifeRecap } from "@lifesim/core";
import { api, type Career, type Profile } from "../api";
import { AVATARS, GOOD_OUTCOMES, OUTCOME_LABELS, careerName } from "../format";
import type { Lobby, MatchStatus } from "../useGame";
import { RecapView } from "./Recap";

interface Props {
  token: string;
  onLogout: () => void;
  connected: boolean;
  lobby: Lobby;
  match: MatchStatus | null;
  searching: boolean;
  findMatch: (career: string) => Promise<{ ok: boolean; error?: string } | undefined>;
  cancelMatch: () => Promise<void>;
}

export function LobbyScreen({ token, onLogout, connected, lobby, match, searching, findMatch, cancelMatch }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [career, setCareer] = useState<string>(() => {
    try {
      return localStorage.getItem("lifesim.career") ?? "civilian";
    } catch {
      return "civilian";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [openRecap, setOpenRecap] = useState<LifeRecap | null>(null);

  useEffect(() => {
    api<Profile>("/api/me", { token }).then(setProfile, () => onLogout());
    api<Career[]>("/api/careers").then(setCareers, () => setError("Could not load careers."));
  }, [token, onLogout]);

  function choose(id: string) {
    setCareer(id);
    try {
      localStorage.setItem("lifesim.career", id);
    } catch {
      /* not remembered */
    }
  }

  async function setAvatar(avatar: string) {
    await api("/api/me/avatar", { method: "PUT", body: { avatar }, token });
    setProfile((p) => (p ? { ...p, avatar } : p));
  }

  async function play() {
    setError(null);
    const res = await findMatch(career);
    if (!res?.ok) setError(res?.error === "already_in_session" ? "You are already in a session." : "Could not join matchmaking.");
  }

  const selected = careers.find((c) => c.id === career);

  return (
    <main className="lobby">
      <header className="topbar">
        <span className="brand small">Life Simulation</span>
        <span className="online" title="Players online">
          <span className={connected ? "dot on" : "dot"} /> {lobby.online} online · {lobby.activeSessions} lives in progress
        </span>
        <button className="ghost" onClick={onLogout}>
          Log out
        </button>
      </header>

      <section className="card profile">
        <div className="avatar-picker">
          <span className="avatar big" aria-label="Your avatar">
            {AVATARS[profile?.avatar ?? "default"] ?? "🙂"}
          </span>
          <div className="avatar-options" aria-label="Choose avatar">
            {Object.entries(AVATARS).map(([id, emoji]) => (
              <button key={id} className={profile?.avatar === id ? "avatar-option active" : "avatar-option"} onClick={() => setAvatar(id)} aria-label={id}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>{profile?.username ?? "…"}</h2>
          <div className="stats">
            <Stat label="Lives lived" value={profile?.stats.gamesPlayed ?? 0} />
            <Stat label="Avg. life score" value={profile?.stats.averageLifeScore ?? "–"} />
            <Stat label="Deaths" value={profile?.stats.deaths ?? 0} />
            <Stat label="Reputation" value={profile?.stats.reputation ?? 50} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Choose your career</h2>
        <div className="career-grid" role="radiogroup" aria-label="Career">
          {careers.map((c) => (
            <button key={c.id} role="radio" aria-checked={c.id === career} className={c.id === career ? "career active" : "career"} onClick={() => choose(c.id)} disabled={searching}>
              <strong>{c.name}</strong>
              <span>{c.description}</span>
            </button>
          ))}
        </div>
        {selected && (
          <div className="career-detail">
            <div>
              <h3>Abilities</h3>
              <ul>
                {selected.abilities.map((a) => (
                  <li key={a.name}>
                    <strong>{a.name}.</strong> {a.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Strengths</h3>
              <ul>{selected.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              <h3>Weaknesses</h3>
              <ul>{selected.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
        )}
        <div className="play-row">
          {searching ? (
            <>
              <p className="searching" aria-live="polite">
                Looking for other people…
                {match && (match.fillInMs > 0 ? ` Bots will fill the empty seats in ${Math.ceil(match.fillInMs / 1000)} s.` : " Starting with bots.")}
              </p>
              <button className="ghost" onClick={cancelMatch}>
                Cancel
              </button>
            </>
          ) : (
            <button className="primary big" onClick={play} disabled={!connected || !selected}>
              Find a life as {selected?.name ?? "…"}
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {profile && profile.recentLives.length > 0 && (
        <section className="card">
          <h2>Previous lives</h2>
          <ul className="lives">
            {profile.recentLives.map((l) => (
              <li key={l.sessionId}>
                <button className="life" onClick={() => setOpenRecap(l.recap)}>
                  <span>
                    {l.recap.name}, {careerName(l.recap.career)}
                  </span>
                  <span className="chips">
                    {l.recap.outcomes.slice(0, 3).map((o) => (
                      <span key={o} className={GOOD_OUTCOMES.has(o) ? "chip good" : "chip bad"}>
                        {OUTCOME_LABELS[o]}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openRecap && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setOpenRecap(null)}>
          <div className="modal-body card" onClick={(e) => e.stopPropagation()}>
            <RecapView recap={openRecap} />
            <button className="primary" onClick={() => setOpenRecap(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
