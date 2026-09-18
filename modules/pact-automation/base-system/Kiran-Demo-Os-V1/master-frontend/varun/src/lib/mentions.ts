/**
 * Mention parsing.
 *
 * Mentions are stored in the message text in a stable, unambiguous encoding —
 * `<@u2>` for a user, `<!engineering>` for a group, `<!channel>` / `<!here>`
 * for broadcasts — rather than as a display name. That means renaming a user
 * never breaks an old mention, and it removes the ambiguity of matching
 * free-text `@Priya` against a directory at render time. The composer converts
 * between the encoding and what the user sees.
 */

import type { GroupHandle, MessageMentions, User, UserGroup, UserId } from "./chat-types";

export const USER_TOKEN = /<@([a-zA-Z0-9_-]+)>/g;
export const SPECIAL_TOKEN = /<!([a-zA-Z0-9_-]+)>/g;

export const BROADCAST_HANDLES = ["channel", "here"] as const;
export type BroadcastHandle = (typeof BROADCAST_HANDLES)[number];

export function isBroadcast(handle: string): handle is BroadcastHandle {
  return (BROADCAST_HANDLES as readonly string[]).includes(handle);
}

/** Extracts the structured mention set stored alongside a message. */
export function parseMentions(text: string, groups: UserGroup[]): MessageMentions {
  const users = new Set<UserId>();
  const groupHandles = new Set<GroupHandle>();
  let broadcast: MessageMentions["broadcast"] = null;

  for (const match of text.matchAll(USER_TOKEN)) users.add(match[1]!);
  for (const match of text.matchAll(SPECIAL_TOKEN)) {
    const handle = match[1]!;
    if (isBroadcast(handle)) {
      // `@channel` outranks `@here` when both appear.
      if (handle === "channel" || broadcast === null) broadcast = handle;
      continue;
    }
    if (groups.some((group) => group.handle === handle)) groupHandles.add(handle);
  }

  return { users: [...users], groups: [...groupHandles], broadcast };
}

/**
 * Resolves a mention set to the users who should actually be notified.
 * `@here` deliberately narrows to online members — that is the whole point of
 * it existing next to `@channel`.
 */
export function resolveMentionTargets(
  mentions: MessageMentions | undefined,
  room: { participantIds: UserId[] },
  users: User[],
  groups: UserGroup[],
): UserId[] {
  if (!mentions) return [];
  const targets = new Set<UserId>();
  const isMember = (id: UserId) => room.participantIds.includes(id);

  for (const id of mentions.users) if (isMember(id)) targets.add(id);

  for (const handle of mentions.groups) {
    const group = groups.find((g) => g.handle === handle);
    if (!group) continue;
    for (const id of group.memberIds) if (isMember(id)) targets.add(id);
  }

  if (mentions.broadcast === "channel") {
    for (const id of room.participantIds) targets.add(id);
  } else if (mentions.broadcast === "here") {
    for (const id of room.participantIds) {
      if (users.find((u) => u.id === id)?.online) targets.add(id);
    }
  }

  return [...targets];
}

export function mentionsUser(
  mentions: MessageMentions | undefined,
  userId: UserId,
  room: { participantIds: UserId[] },
  users: User[],
  groups: UserGroup[],
): boolean {
  return resolveMentionTargets(mentions, room, users, groups).includes(userId);
}

/** Turns the stored encoding into readable text for search, previews and the AI context. */
export function toPlainText(text: string, users: User[], groups: UserGroup[]): string {
  return text
    .replace(USER_TOKEN, (_, id: string) => {
      const user = users.find((u) => u.id === id);
      return `@${user ? user.name : "unknown"}`;
    })
    .replace(SPECIAL_TOKEN, (_, handle: string) => {
      if (isBroadcast(handle)) return `@${handle}`;
      const group = groups.find((g) => g.handle === handle);
      return `@${group ? group.handle : handle}`;
    });
}

export interface MentionCandidate {
  key: string;
  /** What gets inserted into the message text. */
  token: string;
  /** What the user sees in the autocomplete list. */
  label: string;
  detail: string;
  kind: "user" | "group" | "broadcast" | "agent";
  user?: User;
}

/** Ranked autocomplete candidates for the text after an `@`. */
export function mentionCandidates(
  query: string,
  users: User[],
  groups: UserGroup[],
  currentUserId: UserId,
  roomParticipantIds: UserId[],
): MentionCandidate[] {
  const q = query.toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(q);
  const candidates: MentionCandidate[] = [];

  if (matches("agent")) {
    candidates.push({
      key: "agent",
      token: "@agent",
      label: "@agent",
      detail: "Ask the private AI assistant",
      kind: "agent",
    });
  }

  for (const user of users) {
    if (user.id === currentUserId) continue;
    if (!roomParticipantIds.includes(user.id)) continue;
    if (q && !matches(user.name)) continue;
    candidates.push({
      key: user.id,
      token: `<@${user.id}>`,
      label: user.name,
      detail: user.role,
      kind: "user",
      user,
    });
  }

  for (const group of groups) {
    if (q && !matches(group.handle) && !matches(group.name)) continue;
    candidates.push({
      key: group.id,
      token: `<!${group.handle}>`,
      label: `@${group.handle}`,
      detail: `${group.name} · ${group.memberIds.length} people`,
      kind: "group",
    });
  }

  for (const handle of BROADCAST_HANDLES) {
    if (q && !matches(handle)) continue;
    candidates.push({
      key: handle,
      token: `<!${handle}>`,
      label: `@${handle}`,
      detail:
        handle === "channel"
          ? "Notify everyone in this conversation"
          : "Notify everyone who is online",
      kind: "broadcast",
    });
  }

  return candidates.slice(0, 8);
}

/** Locates the `@…` fragment the caret currently sits in, if any. */
export function activeMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = /(?:^|\s)@([\w-]*)$/.exec(before);
  if (!match) return null;
  return { query: match[1]!.toLowerCase(), start: caret - match[1]!.length - 1 };
}

/* -------------------------------------------------------------------------- */
/* Free-text mentions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Broadcast words people actually type. `@channel`/`@here` are what the
 * composer inserts; `@all`/`@everyone` are what everybody writes by hand.
 */
const PLAIN_BROADCASTS: Record<string, BroadcastHandle> = {
  all: "channel",
  everyone: "channel",
  channel: "channel",
  here: "here",
};

/**
 * Characters that may precede an `@` for it to start a mention. Excluding `<`
 * is what keeps the stored `<@u2>` encoding from being matched a second time,
 * and excluding word characters keeps `me@example.com` from mentioning anyone.
 */
const MENTION_BOUNDARY = /[\w<@]/;

export interface PlainMentions {
  users: UserId[];
  broadcast: BroadcastHandle | null;
}

/**
 * Parses hand-typed `@Name` mentions against a room's members.
 *
 * Names are matched longest-first so `@Priya Kapoor` wins over `@Priya`, and
 * a matched span is consumed so the surname is never re-read as a second
 * mention. `@agent` is deliberately not a mention: it is a private AI call.
 */
export function parsePlainMentions(text: string, members: User[]): PlainMentions {
  const needles: Array<{ needle: string; id: UserId | null; broadcast: BroadcastHandle | null }> =
    [];

  for (const member of members) {
    const full = member.name.trim();
    if (full) needles.push({ needle: full, id: member.id, broadcast: null });
    const first = full.split(/\s+/)[0];
    if (first && first !== full) needles.push({ needle: first, id: member.id, broadcast: null });
  }
  for (const [word, handle] of Object.entries(PLAIN_BROADCASTS)) {
    needles.push({ needle: word, id: null, broadcast: handle });
  }
  needles.sort((a, b) => b.needle.length - a.needle.length);

  const lower = text.toLowerCase();
  const consumed: Array<[number, number]> = [];
  const overlaps = (start: number, end: number) =>
    consumed.some(([from, to]) => start < to && end > from);

  const users = new Set<UserId>();
  let broadcast: BroadcastHandle | null = null;

  for (const { needle, id, broadcast: handle } of needles) {
    const token = `@${needle.toLowerCase()}`;
    let from = 0;
    for (;;) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      from = at + token.length;
      const before = at > 0 ? text[at - 1]! : "";
      const after = text[at + token.length] ?? "";
      // A trailing word character means this is a longer, different name.
      if ((before && MENTION_BOUNDARY.test(before)) || /[\w-]/.test(after)) continue;
      if (overlaps(at, at + token.length)) continue;
      consumed.push([at, at + token.length]);
      if (id) users.add(id);
      // `@channel` outranks `@here` when both appear, matching parseMentions.
      else if (handle === "channel" || broadcast === null) broadcast = handle;
    }
  }

  return { users: [...users], broadcast };
}

export interface MentionAudience {
  /** Users who get a personal "For you" notification. */
  personal: UserId[];
  /** Set when the message addressed the whole room. */
  broadcast: BroadcastHandle | null;
}

/**
 * Resolves everything a message addresses, from both the stored token encoding
 * and hand-typed `@Name` text, keeping personal mentions separate from
 * room-wide broadcasts — they have different audiences.
 */
export function resolveMentionAudience(
  message: { content: string; mentions?: MessageMentions | undefined },
  room: { participantIds: UserId[] },
  users: User[],
  groups: UserGroup[],
): MentionAudience {
  const personal = new Set<UserId>();
  const isMember = (id: UserId) => room.participantIds.includes(id);
  let broadcast: BroadcastHandle | null = message.mentions?.broadcast ?? null;

  for (const id of message.mentions?.users ?? []) if (isMember(id)) personal.add(id);
  for (const handle of message.mentions?.groups ?? []) {
    const group = groups.find((g) => g.handle === handle);
    if (!group) continue;
    for (const id of group.memberIds) if (isMember(id)) personal.add(id);
  }

  const members = users.filter((user) => isMember(user.id));
  const plain = parsePlainMentions(message.content, members);
  for (const id of plain.users) personal.add(id);
  if (plain.broadcast === "channel" || (plain.broadcast && broadcast === null)) {
    broadcast = plain.broadcast;
  }

  return { personal: [...personal], broadcast };
}
