# Chat Server — a Shared Operation Log

**Date:** 2026-09-28
**Status:** Approved
**Scope:** Sub-project #2 of four (see `2026-09-22-ios-app-design.md`).
Sub-project #1, identity, is not built; this spec trusts the client's
claimed user (see Identity).

## Problem

The chat is local-only. `lib/transport.ts`, described as the seam for a
real API client, carries only `{clientId, roomId, senderId}` — never the
message — and has no receive path. Every other change (the chat store
mutates messages in 31 places, plus rooms, membership, reactions, pins,
read state) never touches the transport. Two people cannot talk.

## Decisions

- **Scope:** the whole workspace, not only messages.
- **Identity:** the client asserts its user (the person picked on the Me
  screen) and the server trusts it, behind one function real sign-in
  replaces. Anyone on the network can post as anyone until then.
- **Architecture:** a shared operation log. The server orders, stores and
  broadcasts operations; every client folds them with one TypeScript
  reducer extracted from the store's existing logic. Rejected: a
  server-authoritative model, which would re-implement ~60 mutations in
  Python and keep two copies of the rules in step.

## Server

The kiran-payment FastAPI backend (:3001), new `chat` router. SQLite in
`backend/data/chat.db` (git-ignored, like the rest of `backend/data/`).

| Endpoint | Purpose |
| --- | --- |
| `GET /api/chat/log?since=N&user=U` | Base state (when N is 0) and every op after N visible to U |
| `POST /api/chat/ops` | Append an op; idempotent on `opId`; returns `seq`, `ts`, `duplicate` |
| `GET /api/chat/events?since=N&user=U` | Server-sent events: each new op visible to U |
| `POST /api/chat/attachments` | Upload a file; returns its `/uploads/...` URL |

An op row: `seq` (total order), `op_id` (unique; the idempotency key),
`actor`, `private_to` (null, or the one user who may see it), `ts`
(server time, authoritative), `body` (JSON).

Validation is structural: a known op type, an actor in the directory, and
a room that exists (seeded, or created by an earlier `room.create`).
Membership is not checked: it changes through ops, so checking it would
mean re-implementing part of the reducer in Python, and while the actor
is taken on trust it would protect nothing. Membership and permission
checks arrive with identity.

The base state is exported from the console's TypeScript seed to
`backend/chat_seed.json` by a script, so server and clients start from
the same workspace.

## Client

- `lib/chat-ops.ts` (in the console, shared): op types and a pure
  `applyOp(state, op)` extracted from the store's mutation bodies.
- The store keeps `confirmed` (base + server ops, in `seq` order) and
  `pending` (local ops not yet echoed). What renders is `pending` folded
  over `confirmed`. A change is `dispatch(op)`: it appears at once, queues
  in the outbox, posts, and leaves `pending` when its echo arrives.
- The outbox, retry, backoff and `clientId` idempotency the store has for
  messages extend to every op.
- Toggles are dispatched as explicit intents (`reaction.set … on: true`),
  so a retried or reordered op cannot flip state back.
- `lib/chat-sync.ts` replaces `createLocalTransport`: load the log, follow
  the event stream, resume from the last `seq` after a disconnect.

## What syncs

| | |
| --- | --- |
| Shared | Rooms, membership, admins, invites, room settings, messages (send, edit, delete, react, pin, forward, threads), meetings, read state |
| Private to one user (`private_to`) | Saved messages, followed threads, notification levels and mutes |
| Derived on each client | Notifications, from the messages it receives |
| Device only | Drafts, the open room, the picked user, assistant history |

On first connection the server's workspace replaces a device's local
copy; drafts are kept.

## Attachments

Files above the inline limit upload to the server and the message
carries the server URL, so other people can see them. Small files stay
inline, as now. The device-local blob stores remain for attachments sent
before this change.

## Identity

`resolve_actor(request, claimed)` on the server returns the claimed user
if it is in the directory. Sign-in replaces this one function.

## Build order

1. Server: log, ops, events, seed export; Python tests.
2. Reducer: `chat-ops.ts`; the store dispatches ops locally, with no
   server yet. All existing tests must pass unchanged.
3. Sync: the store talks to the server; offline ops queue and replay.
4. Attachment upload.
5. End to end: two people chatting live, phone app and console.

## Known limits

- Anyone can post as anyone until identity exists.
- The log replays from the start on every load; compaction comes later.
- Scheduled messages send only while the author's app is open, as today.
