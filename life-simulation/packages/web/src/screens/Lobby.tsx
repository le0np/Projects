import { useEffect, useState, type FormEvent } from "react";
import type { ChapterRecap, LifeRecap } from "@lifesim/core";
import { api, ApiError, type AuthResult, type Career, type Profile } from "../api";
import { AVATARS, GOOD_OUTCOMES, OUTCOME_LABELS, careerName, randomName } from "../format";
import type { Lobby, MatchStatus } from "../useGame";
import { RecapView } from "./Recap";
import { ChapterRecapView, LifeCreate, type LifeOptions } from "./Life";

interface Props {
  token: string;
  onLogout: () => void;
  connected: boolean;
  lobby: Lobby;
  match: MatchStatus | null;
  searching: boolean;
  findMatch: (career: string, name: string) => Promise<{ ok: boolean; error?: string } | undefined>;
  startLife: Parameters<typeof LifeCreate>[0]["startLife"];
  createRoom: (name: string, career: string) => Promise<{ ok: boolean; error?: string } | undefined>;
  joinRoom: (code: string, name: string, career: string) => Promise<{ ok: boolean; error?: string } | undefined>;
  /** T14: why opening a room link did not work, if it did not. */
  roomError?: string | null;
  cancelMatch: () => Promise<void>;
}

export function LobbyScreen({
  token,
  onLogout,
  connected,
  lobby,
  match,
  searching,
  findMatch,
  cancelMatch,
  createRoom,
  joinRoom,
  roomError,
  startLife,
}: Props) {
  const [code, setCode] = useState("");
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
  const [openRecap, setOpenRecap] = useState<LifeRecap | ChapterRecap | null>(null);
  // Sprint 5: "Life in chapters" is the game; the old real-time town only with LEGACY_TOWN=1.
  const [options, setOptions] = useState<LifeOptions | null>(null);
  useEffect(() => {
    api<LifeOptions>("/api/life/options").then(setOptions, () => setError("Could not load the game options."));
  }, []);
  const legacy = options?.legacyTown === true;

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

  // B4: the character gets a name of its own (not the username), with a random suggestion.
  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem("lifesim.name") || randomName();
    } catch {
      return randomName();
    }
  });
  const nameOk = /^\p{L}[\p{L} '-]{1,15}$/u.test(name.trim());
  function changeName(value: string) {
    setName(value);
    try {
      localStorage.setItem("lifesim.name", value);
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
    const res = await findMatch(career, name.trim());
    if (!res?.ok)
      setError(
        res?.error === "already_in_session"
          ? "You are already in a session."
          : res?.error === "invalid_name"
            ? "Please choose a name of 2–16 letters."
            : "Could not join matchmaking.",
      );
  }

  const selected = careers.find((c) => c.id === career);

  return (
    <main className="lobby">
      <header className="topbar">
        <span className="brand small">Life Simulation</span>
        <span className="online" title="Players online">
          <span className={connected ? "dot on" : "dot"} /> {lobby.online} online · {lobby.activeSessions} lives in progress
        </span>
        <button
          className="ghost"
          onClick={() => {
            // T15: a guest has no password, so logging out loses the account.
            if (!profile?.isGuest || window.confirm("You are a guest: if you log out, this account and its titles are gone. Log out anyway?")) onLogout();
          }}
        >
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
          <h2>{profile ? (profile.isGuest ? `${name} (guest)` : profile.username) : "…"}</h2>
          <div className="stats">
            <Stat label="Lives lived" value={profile?.stats.gamesPlayed ?? 0} />
            <Stat label="Avg. life score" value={profile?.stats.averageLifeScore ?? "–"} />
            <Stat label="Deaths" value={profile?.stats.deaths ?? 0} />
            <Stat label="Reputation" value={profile?.stats.reputation ?? 50} />
          </div>
        </div>
      </section>

      {profile?.isGuest && <SaveAccount token={token} onSaved={(p) => setProfile((old) => (old ? { ...old, ...p, isGuest: false } : old))} />}

      {options && !legacy && <LifeCreate options={options} connected={connected} startLife={startLife} />}
      {!legacy && error && <p className="error">{error}</p>}

      {legacy && (
        <section className="card">
          <h2>Choose your career</h2>
          <div className="career-grid" role="radiogroup" aria-label="Career">
            {careers.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={c.id === career}
                className={c.id === career ? "career active" : "career"}
                onClick={() => choose(c.id)}
                disabled={searching}
              >
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
                <ul>
                  {selected.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <h3>Weaknesses</h3>
                <ul>
                  {selected.weaknesses.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="name-row">
            <label htmlFor="character-name">Your character's name</label>
            <input id="character-name" value={name} maxLength={16} onChange={(e) => changeName(e.target.value)} disabled={searching} aria-invalid={!nameOk} />
            <button
              className="ghost"
              type="button"
              onClick={() => changeName(randomName(name))}
              disabled={searching}
              aria-label="Suggest a random name"
              title="Suggest a random name"
            >
              🎲
            </button>
            {!nameOk && <span className="small error">2–16 letters</span>}
          </div>
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
              <>
                <button className="primary big" onClick={play} disabled={!connected || !selected || !nameOk}>
                  Find a life as {selected?.name ?? "…"}
                </button>
                <button
                  className="ghost big"
                  disabled={!connected || !selected || !nameOk}
                  onClick={async () => {
                    const r = await createRoom(name.trim(), career);
                    if (!r?.ok) setError("Could not create a room.");
                  }}
                >
                  Create a room for friends
                </button>
                <span className="join-code">
                  <input aria-label="Room code" placeholder="Code" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                  <button
                    className="ghost"
                    disabled={!connected || code.length !== 4 || !nameOk}
                    onClick={async () => {
                      const r = await joinRoom(code, name.trim(), career);
                      if (!r?.ok) setError(roomErrorText(r?.error));
                    }}
                  >
                    Join
                  </button>
                </span>
              </>
            )}
          </div>
          {(error || roomError) && <p className="error">{error ?? roomError}</p>}
        </section>
      )}

      {profile?.titles && profile.titles.length > 0 && (
        <section className="card">
          <h2>
            Your titles <span className="muted small">· {profile.titles.length} collected</span>
          </h2>
          <p className="chips title-collection">
            {profile.titles.map((t) => (
              <span key={t.id} className="chip title-chip">
                “{t.label}”{t.n > 1 ? ` ×${t.n}` : ""}
              </span>
            ))}
          </p>
        </section>
      )}

      {profile && profile.recentLives.length > 0 && (
        <section className="card">
          <h2>Previous lives</h2>
          <ul className="lives">
            {profile.recentLives.map((l) => (
              <li key={l.sessionId}>
                {"mode" in l.recap ? (
                  <button className="life" onClick={() => setOpenRecap(l.recap)}>
                    <span>
                      {l.recap.name}, {l.recap.career}
                      <span className="muted"> · “{l.recap.title.label}”</span>
                    </span>
                    <span className="chips">
                      <span>{l.recap.years.join("")}</span>
                      <span className={l.recap.dream.done ? "chip good" : "chip bad"}>
                        {l.recap.dream.icon} {l.recap.dream.done ? "Dream came true" : "Dream missed"}
                      </span>
                    </span>
                  </button>
                ) : (
                  <button className="life" onClick={() => setOpenRecap(l.recap)}>
                    <span>
                      {l.recap.name}, {careerName(l.recap.career)}
                      {l.recap.title && <span className="muted"> · “{l.recap.title.label}”</span>}
                    </span>
                    <span className="chips">
                      {l.recap.outcomes.slice(0, 3).map((o) => (
                        <span key={o} className={GOOD_OUTCOMES.has(o) ? "chip good" : "chip bad"}>
                          {OUTCOME_LABELS[o]}
                        </span>
                      ))}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {openRecap && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setOpenRecap(null)}>
          <div className="modal-body card" onClick={(e) => e.stopPropagation()}>
            {"mode" in openRecap ? (
              <div className="lf">
                <ChapterRecapView recap={openRecap} />
              </div>
            ) : (
              <RecapView recap={openRecap} />
            )}
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

/** T14: what to say when a room cannot be joined. */
export function roomErrorText(error: string | undefined): string {
  return error === "started"
    ? "This life has already started."
    : error === "not_found"
      ? "There is no room with that code."
      : error === "full"
        ? "That room is full."
        : error === "already_in_session"
          ? "You are already in a session."
          : "Could not join the room.";
}

/** T15: a guest keeps the same account (titles, history) by adding a username, an email and a password. */
function SaveAccount({ token, onSaved }: { token: string; onSaved: (p: { username: string; email: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<Pick<AuthResult, "user">>("/api/me/upgrade", {
        token,
        body: { username, email, password },
      });
      onSaved(r.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That username or email is already taken.");
      else if (err instanceof ApiError && err.status === 400) setError("Username: 3–20 letters, digits or _. Password: at least 8 characters.");
      else setError("Something went wrong, try again.");
    }
  }
  return (
    <section className="card guest-save">
      <p>
        You are playing as a guest. <span className="muted">Save your account to keep your titles and lives on any device.</span>{" "}
        {!open && (
          <button className="ghost" onClick={() => setOpen(true)}>
            Save my account
          </button>
        )}
      </p>
      {open && (
        <form className="form" onSubmit={submit}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary">Save my account</button>
        </form>
      )}
    </section>
  );
}
