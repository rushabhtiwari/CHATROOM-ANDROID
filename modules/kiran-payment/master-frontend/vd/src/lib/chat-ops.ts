/**
 * The chat's operation catalogue.
 *
 * Every change to the workspace is an operation. Clients append operations to
 * a shared log on the server, the server gives each a place in one total
 * order, and every client folds the log with the same reducer. This file is
 * the single definition of which operations exist: the backend's whitelist is
 * generated from it (`backend/tools/export-chat-seed.mjs` writes
 * `backend/chat_protocol.json`), so the two cannot disagree.
 *
 * Toggles are recorded as intents — `on: true`, `on: false` — never as
 * "toggle". A retried or reordered toggle would flip state back; an intent
 * applied twice lands where it was meant to.
 */

/** Operations every member of a room sees. */
export const SHARED_OP_TYPES = [
  "message.send",
  "message.edit",
  "message.delete",
  "message.reaction",
  "message.pin",
  "meeting.add",
  "room.create",
  "room.update",
  "room.members",
  "room.admin",
  "room.mute_user",
  "room.invite",
  "room.join",
  "read.mark",
  "notification.read",
] as const;

/**
 * Operations only their author sees. The server streams these to the one
 * user who made them: what someone saved or follows is theirs.
 */
export const PRIVATE_OP_TYPES = ["saved.set", "thread.follow", "room.notify"] as const;

export const OP_TYPES = [...SHARED_OP_TYPES, ...PRIVATE_OP_TYPES] as const;

export type OpType = (typeof OP_TYPES)[number];

/**
 * Operations that must name an existing room. `room.create` names one that
 * does not exist yet; the private ones that are not about a room say nothing
 * about one.
 */
export const ROOM_SCOPED_OP_TYPES: readonly OpType[] = OP_TYPES.filter(
  (type) =>
    type !== "room.create" && type !== "saved.set" && type !== "thread.follow",
);
