/**
 * T14: private rooms. A host creates a room with a short code (`KX4P`, link `/r/KX4P`); friends who
 * open the link join its waiting room, pick a name and a career, and the host starts the life.
 * Empty seats are filled by bots. Nobody can join once the life has started; an empty room is gone.
 */
import { randomInt } from "node:crypto";

/** No look-alike characters (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

export interface RoomMember {
  userId: string;
  name: string;
  career: string;
}

export interface Room {
  code: string;
  hostId: string;
  members: RoomMember[];
  state: "waiting" | "playing";
  createdAt: number;
}

export type JoinError = "not_found" | "started" | "full";

/** What every member sees in the waiting room. */
export interface RoomView {
  code: string;
  hostId: string;
  members: (RoomMember & { isHost: boolean })[];
  state: Room["state"];
  maxPlayers: number;
}

export class Rooms {
  private readonly rooms = new Map<string, Room>();
  /** userId → room code (a player is in at most one room). */
  private readonly byUser = new Map<string, string>();

  constructor(
    private readonly maxPlayers: number,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  roomOf(userId: string): Room | undefined {
    const code = this.byUser.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }

  view(room: Room): RoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      members: room.members.map((m) => ({ ...m, isHost: m.userId === room.hostId })),
      state: room.state,
      maxPlayers: this.maxPlayers,
    };
  }

  create(host: RoomMember): Room {
    this.leave(host.userId);
    let code = "";
    do code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    while (this.rooms.has(code));
    const room: Room = { code, hostId: host.userId, members: [{ ...host }], state: "waiting", createdAt: this.now() };
    this.rooms.set(code, room);
    this.byUser.set(host.userId, code);
    return room;
  }

  join(code: string, member: RoomMember): { ok: true; room: Room } | { ok: false; error: JoinError } {
    const room = this.get(code);
    if (!room) return { ok: false, error: "not_found" };
    const existing = room.members.find((m) => m.userId === member.userId);
    if (existing) {
      // Re-joining (a refresh): just update name and career.
      if (room.state === "waiting") Object.assign(existing, { name: member.name, career: member.career });
      return { ok: true, room };
    }
    if (room.state !== "waiting") return { ok: false, error: "started" };
    if (room.members.length >= this.maxPlayers) return { ok: false, error: "full" };
    this.leave(member.userId);
    room.members.push({ ...member });
    this.byUser.set(member.userId, room.code);
    return { ok: true, room };
  }

  update(userId: string, change: Partial<Pick<RoomMember, "name" | "career">>): Room | undefined {
    const room = this.roomOf(userId);
    const me = room?.members.find((m) => m.userId === userId);
    if (!room || !me || room.state !== "waiting") return undefined;
    Object.assign(me, change);
    return room;
  }

  /** Leaves the room; the host passes to the next member; an empty room is removed. */
  leave(userId: string): Room | undefined {
    const room = this.roomOf(userId);
    this.byUser.delete(userId);
    if (!room) return undefined;
    room.members = room.members.filter((m) => m.userId !== userId);
    if (room.members.length === 0) {
      this.rooms.delete(room.code);
      return undefined;
    }
    if (room.hostId === userId) room.hostId = (room.members[0] as RoomMember).userId;
    return room;
  }

  /** Only the host can start, while waiting. */
  start(userId: string): { ok: true; room: Room } | { ok: false; error: "not_in_room" | "not_host" | "started" } {
    const room = this.roomOf(userId);
    if (!room) return { ok: false, error: "not_in_room" };
    if (room.hostId !== userId) return { ok: false, error: "not_host" };
    if (room.state !== "waiting") return { ok: false, error: "started" };
    room.state = "playing";
    return { ok: true, room };
  }

  /** The life is over: everyone still in the room is back in its waiting room (T17: play again). */
  finished(code: string): Room | undefined {
    const room = this.get(code);
    if (room) room.state = "waiting";
    return room;
  }
}
