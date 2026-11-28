/**
 * T14: a private room's waiting room: the code and a link to share, who is here, your name and
 * career, and (for the host) Start. Empty seats are filled by bots when the life starts.
 */
import { useEffect, useState } from "react";
import { api, type Career } from "../api";
import { careerName } from "../format";
import type { RoomView } from "../useGame";

interface Props {
  room: RoomView;
  myUserId: string | null;
  update: (change: { name?: string; career?: string }) => Promise<unknown>;
  leave: () => Promise<void>;
  start: () => Promise<{ ok: boolean; error?: string } | undefined>;
}

export function roomLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

export function RoomScreen({ room, myUserId, update, leave, start }: Props) {
  const [careers, setCareers] = useState<Career[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = room.members.find((m) => m.userId === myUserId);
  const [name, setName] = useState(me?.name ?? "");
  const isHost = room.hostId === myUserId;
  useEffect(() => {
    api<Career[]>("/api/careers").then(setCareers, () => setCareers([]));
  }, []);
  const link = roomLink(room.code);
  const nameOk = /^\p{L}[\p{L} '-]{1,15}$/u.test(name.trim());

  return (
    <main className="lobby room">
      <section className="card">
        <span className="muted small">Private room</span>
        <h1 className="room-code" aria-label={`Room code ${room.code.split("").join(" ")}`}>
          {room.code}
        </h1>
        <p className="room-link">
          <input readOnly value={link} aria-label="Room link" onFocus={(e) => e.currentTarget.select()} />
          <button
            className="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </p>
        <p className="muted small">Send the link to your friends. Empty seats are filled by bots ({room.maxPlayers} people in a life).</p>
      </section>

      <section className="card">
        <h2>
          Who is here <span className="muted small">· {room.members.length} of {room.maxPlayers}</span>
        </h2>
        <ul className="lives room-members">
          {room.members.map((m) => (
            <li key={m.userId}>
              <strong>{m.name}</strong> <span className="muted">· {careerName(m.career)}</span>
              {m.isHost && <span className="chip">host</span>}
              {m.userId === myUserId && <span className="chip good">you</span>}
            </li>
          ))}
        </ul>
      </section>

      {me && room.state === "waiting" && (
        <section className="card">
          <h2>You</h2>
          <div className="name-row">
            <label htmlFor="room-name">Your character's name</label>
            <input id="room-name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => nameOk && name.trim() !== me.name && void update({ name: name.trim() })} />
          </div>
          <div className="career-grid" role="radiogroup" aria-label="Career">
            {careers.map((c) => (
              <button key={c.id} role="radio" aria-checked={c.id === me.career} className={c.id === me.career ? "career active" : "career"} onClick={() => void update({ career: c.id })}>
                <strong>{c.name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card play-row">
        {room.state === "playing" ? (
          <p>The life is starting…</p>
        ) : isHost ? (
          <button
            className="primary big"
            disabled={!nameOk}
            onClick={async () => {
              if (nameOk && me && name.trim() !== me.name) await update({ name: name.trim() });
              const r = await start();
              setError(r?.ok ? null : "Could not start.");
            }}
          >
            Start the life
          </button>
        ) : (
          <p className="muted">Waiting for {room.members.find((m) => m.isHost)?.name ?? "the host"} to start…</p>
        )}
        <button className="ghost" onClick={() => void leave()}>
          Leave the room
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
