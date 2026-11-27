import { useState, type FormEvent } from "react";
import { api, ApiError, type AuthResult } from "../api";

/**
 * T15: the start screen leads with "Play as guest" (just a name). A room link (/r/KX4P) shows only
 * that: type a name, one click, and you are in the room's waiting room.
 */
export function AuthScreen({ onAuthenticated, roomCode }: { onAuthenticated: (token: string) => void; roomCode?: string | null }) {
  const [mode, setMode] = useState<"guest" | "login" | "register">("guest");
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem("lifesim.name") ?? "";
    } catch {
      return "";
    }
  });
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "guest") {
        const name = guestName.trim();
        const result = await api<AuthResult>("/api/guest", { body: { name } });
        try {
          localStorage.setItem("lifesim.name", name);
        } catch {
          /* the lobby suggests a name instead */
        }
        onAuthenticated(result.token);
        return;
      }
      const result =
        mode === "login"
          ? await api<AuthResult>("/api/login", {
              body: { login: username, password },
            })
          : await api<AuthResult>("/api/register", {
              body: { username, email, password },
            });
      onAuthenticated(result.token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError("Too many guests from this network right now. Create an account instead.");
      else if (err instanceof ApiError && err.status === 400 && mode === "guest") setError("Use 2–16 letters (spaces, ' and - are fine).");
      else if (err instanceof ApiError && err.status === 401) setError("Wrong username or password.");
      else if (err instanceof ApiError && err.status === 409) setError("That username or email is already taken.");
      else setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card card">
        <h1 className="brand">Life Simulation</h1>
        {roomCode ? (
          <p className="lead">You are invited to room {roomCode}. What is your name?</p>
        ) : (
          <p className="muted">A short life, shared with strangers. Your choices shape it — and so do theirs.</p>
        )}
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "guest"} className={mode === "guest" ? "tab active" : "tab"} onClick={() => setMode("guest")}>
            Play as guest
          </button>
          <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            Log in
          </button>
          <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>
        <form onSubmit={submit} className="form">
          {mode === "guest" ? (
            <label>
              Your character's name
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={16}
                autoFocus
                autoComplete="nickname"
                placeholder="e.g. Maja"
                required
              />
            </label>
          ) : (
            <>
              <label>
                {mode === "login" ? "Username or email" : "Username"}
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
              </label>
              {mode === "register" && (
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
              )}
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : undefined}
                  required
                />
              </label>
            </>
          )}
          {mode === "guest" && <p className="muted small">No email, no password. You can save your account later.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "…" : mode === "guest" ? (roomCode ? "Join the room" : "Play as guest") : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
