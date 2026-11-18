/** HTTP client for the game server. The token is kept in localStorage (per-browser convenience). */
import type { LifeRecap } from "@lifesim/core";

const TOKEN_KEY = "lifesim.token";

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode etc.: the session simply is not remembered.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; details?: { path: string; message: string }[] } | null,
  ) {
    super(body?.details?.map((d) => `${d.path}: ${d.message}`).join("; ") || body?.error || `HTTP ${status}`);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface Career {
  id: string;
  name: string;
  description: string;
  abilities: { name: string; description: string }[];
  strengths: string[];
  weaknesses: string[];
}

export interface Profile {
  username: string;
  email: string;
  avatar: string;
  stats: { gamesPlayed: number; deaths: number; averageLifeScore: number | null; reputation: number };
  recentLives: { sessionId: string; endedAt: string; recap: LifeRecap }[];
  activeSessionId: string | null;
  inQueue: boolean;
}

export interface AuthResult {
  token: string;
  user: { id: string; username: string; email: string };
}
