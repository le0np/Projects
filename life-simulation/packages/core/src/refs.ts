/**
 * References to characters inside event definitions.
 *
 * - `"self"`        — the character being evaluated (role candidate, chooser).
 * - `"role:<name>"` — every character bound to that role of the current event.
 * - `"session"`     — the session itself (only valid as a fact effect target).
 */
export type Ref = string;

export type ParsedRef = { kind: "self" } | { kind: "role"; role: string } | { kind: "session" };

const ROLE_REF = /^role:([a-z][a-z0-9_]*)$/;

export function parseRef(ref: string): ParsedRef | null {
  if (ref === "self") return { kind: "self" };
  if (ref === "session") return { kind: "session" };
  const m = ROLE_REF.exec(ref);
  return m ? { kind: "role", role: m[1] as string } : null;
}

export function roleRef(role: string): Ref {
  return `role:${role}`;
}
