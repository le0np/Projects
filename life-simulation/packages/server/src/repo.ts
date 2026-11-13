/** All SQL lives here. */
import { randomUUID } from "node:crypto";
import type { LifeRecap } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import type { LogEntry, SessionResult } from "@lifesim/engine";
import { hashPassword, hashToken, newToken, verifyPassword } from "./auth";
import type { Database } from "./db/database";

const TOKEN_TTL_DAYS = 30;

export interface UserRow {
  id: string;
  username: string;
  email: string;
}

export interface ParticipantRecord {
  characterKey: string;
  userId: string | null;
  name: string;
  career: string;
  isBot: boolean;
  botProfile?: unknown;
}

export class Repo {
  constructor(private readonly db: Database) {}

  // ---------------------------------------------------------------- users

  async register(username: string, email: string, password: string): Promise<{ user: UserRow; token: string } | { error: "taken" }> {
    const existing = await this.db.query("SELECT 1 FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($2)", [username, email]);
    if (existing.rows.length > 0) return { error: "taken" };
    const id = randomUUID();
    const hash = await hashPassword(password);
    await this.db.transaction(async (tx) => {
      await tx.query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)", [id, username, email, hash]);
      await tx.query("INSERT INTO player_profiles (user_id) VALUES ($1)", [id]);
    });
    return { user: { id, username, email }, token: await this.issueToken(id) };
  }

  async login(login: string, password: string): Promise<{ user: UserRow; token: string } | null> {
    const { rows } = await this.db.query<UserRow & { password_hash: string }>(
      "SELECT id, username, email, password_hash FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1)",
      [login],
    );
    const row = rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) return null;
    return { user: { id: row.id, username: row.username, email: row.email }, token: await this.issueToken(row.id) };
  }

  private async issueToken(userId: string): Promise<string> {
    const token = newToken();
    await this.db.query(
      `INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${TOKEN_TTL_DAYS} days')`,
      [hashToken(token), userId],
    );
    return token;
  }

  async userByToken(token: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      "SELECT u.id, u.username, u.email FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.expires_at > now()",
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async revokeToken(token: string): Promise<void> {
    await this.db.query("DELETE FROM auth_tokens WHERE token_hash = $1", [hashToken(token)]);
  }

  async profile(userId: string) {
    const { rows } = await this.db.query<{
      username: string;
      avatar: string;
      games_played: number;
      deaths: number;
      total_life_score: number;
      reputation: number;
    }>(
      `SELECT u.username, p.avatar, p.games_played, p.deaths, p.total_life_score, p.reputation
         FROM users u JOIN player_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [userId],
    );
    const p = rows[0];
    if (!p) return null;
    const recent = await this.db.query<{ session_id: string; recap: LifeRecap; ended_at: string }>(
      `SELECT r.session_id, r.recap, s.ended_at FROM session_results r JOIN sessions s ON s.id = r.session_id
        WHERE r.user_id = $1 ORDER BY s.ended_at DESC LIMIT 5`,
      [userId],
    );
    return {
      username: p.username,
      avatar: p.avatar,
      stats: {
        gamesPlayed: p.games_played,
        deaths: p.deaths,
        averageLifeScore: p.games_played > 0 ? Math.round(p.total_life_score / p.games_played) : null,
        reputation: p.reputation,
      },
      recentLives: recent.rows.map((r) => ({ sessionId: r.session_id, endedAt: r.ended_at, recap: r.recap })),
    };
  }

  async setAvatar(userId: string, avatar: string): Promise<void> {
    await this.db.query("UPDATE player_profiles SET avatar = $2 WHERE user_id = $1", [userId, avatar]);
  }

  // ---------------------------------------------------------------- sessions

  async sessionStarted(input: {
    id: string;
    engineId: string;
    seed: string;
    config: unknown;
    content: ContentBundle;
    participants: ParticipantRecord[];
  }): Promise<void> {
    const bundle = {
      careers: [...input.content.careers.values()],
      facts: [...input.content.facts.values()],
      events: [...input.content.events.values()],
    };
    await this.db.transaction(async (tx) => {
      await tx.query("INSERT INTO content_versions (hash, bundle) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING", [
        input.content.hash,
        JSON.stringify(bundle),
      ]);
      await tx.query("INSERT INTO sessions (id, engine_id, seed, status, config, content_hash) VALUES ($1, $2, $3, 'active', $4, $5)", [
        input.id,
        input.engineId,
        input.seed,
        JSON.stringify(input.config),
        input.content.hash,
      ]);
      for (const p of input.participants) {
        await tx.query(
          "INSERT INTO session_participants (session_id, character_key, user_id, name, career, is_bot, bot_profile) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [input.id, p.characterKey, p.userId, p.name, p.career, p.isBot, p.botProfile === undefined ? null : JSON.stringify(p.botProfile)],
        );
      }
    });
  }

  /** Idempotent: a decision is stored at most once per (session, event instance, character). */
  async decisionMade(sessionId: string, e: Extract<LogEntry, { type: "decision" }>): Promise<void> {
    await this.db.query(
      `INSERT INTO decisions (session_id, instance_id, character_key, choice_id, source, session_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [sessionId, e.instanceId, e.characterId, e.choiceId, e.source, Math.round(e.t)],
    );
  }

  async sessionFinished(sessionId: string, result: SessionResult, userOf: (characterKey: string) => string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query("UPDATE sessions SET status = $2, ended_at = now(), end_reason = $3 WHERE id = $1", [
        sessionId,
        result.state === "cancelled" ? "cancelled" : "completed",
        result.endReason ?? null,
      ]);
      await tx.query("INSERT INTO session_logs (session_id, log) VALUES ($1, $2)", [sessionId, JSON.stringify(result.log)]);
      for (const r of result.recaps) {
        const userId = userOf(r.characterId);
        await tx.query("UPDATE session_participants SET final_status = $3 WHERE session_id = $1 AND character_key = $2", [
          sessionId,
          r.characterId,
          r.finalStatus,
        ]);
        await tx.query(
          `INSERT INTO session_results (session_id, character_key, user_id, final_status, outcomes, life_score, life_duration_ms, recap)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [sessionId, r.characterId, userId, r.finalStatus, r.outcomes, r.lifeScore, Math.round(r.lifeDurationMs), JSON.stringify(r)],
        );
        if (userId) {
          await tx.query(
            `UPDATE player_profiles SET games_played = games_played + 1, deaths = deaths + $2, total_life_score = total_life_score + $3,
               reputation = GREATEST(0, LEAST(100, reputation + $4)) WHERE user_id = $1`,
            [userId, r.finalStatus === "dead" ? 1 : 0, r.lifeScore, Math.round((r.finalAttrs.reputation - r.startAttrs.reputation) / 4)],
          );
        }
      }
    });
  }

  async sessionLog(sessionId: string): Promise<LogEntry[] | null> {
    const { rows } = await this.db.query<{ log: LogEntry[] }>("SELECT log FROM session_logs WHERE session_id = $1", [sessionId]);
    return rows[0]?.log ?? null;
  }

  async isParticipant(sessionId: string, userId: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2", [sessionId, userId]);
    return rows.length > 0;
  }

  /** Sessions left "active" by a crash or restart cannot be resumed (their state lived in memory). */
  async cancelOrphanedSessions(): Promise<number> {
    const { rows } = await this.db.query(
      "UPDATE sessions SET status = 'cancelled', ended_at = now(), end_reason = 'server_restart' WHERE status = 'active' RETURNING id",
    );
    return rows.length;
  }
}
