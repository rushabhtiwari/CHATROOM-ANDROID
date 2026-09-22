# KiranOS for iOS

The conversation workspace and order tracking, on a phone. Capacitor around a
Vite/React app that shares its domain layer with the console in
`../master-frontend/vd`.

## Run it

```bash
npm install          # from modules/kiran-payment, the workspace root
npm run dev --workspace mobile
```

Then open <http://localhost:5174> and set the browser to a phone width. The
console's own API proxy is reused, so run the Python backend on `:3001` if you
want the assistant, claim cards or meetings to do anything — without it those
report that they have no model rather than failing.

## What is shared, and what is not

The domain layer is imported from the console and never copied:

| Imported as | What it is |
| --- | --- |
| `@/lib/chat-store` | `useChat()` — rooms, messages, delivery, threads, read state, the assistant |
| `@/lib/chat-types` | The chat model |
| `@/lib/transport` | The simulated network; the seam a real chat server replaces |
| `@/data/orders`, `@/data/dispatches` | The order and dispatch records |
| `@/modules/rts/*` | Claims, which conversations can carry |

Every screen and component under `src/` is written for the phone. The console's
sidebar, context panel, command palette and data grids are not used.

### The two aliases

- `@` means **the console**, exactly as it does inside the console itself. The
  console has 292 imports written as `@/lib/...`; they have to keep meaning the
  console's source when Vite compiles those files into this app.
- `~` means **this app**.

## Talking to the server

The console reaches the API through relative paths, which work because Vite
proxies them. A Capacitor app is served from `capacitor://localhost` and has no
proxy, so a relative `/api/state` resolves to the app bundle.

`src/api/origin.ts` is the one place that knows where the server is. It reads
`VITE_API_ORIGIN`: empty on the web, an absolute origin for any build that runs
on a device. Copy `.env.example` to `.env` and set it before building for a
phone. The backend must allow CORS for `capacitor://localhost`.

## Native behaviour

`src/native/` holds every Capacitor adapter, and each one is a no-op on the web
so screens never have to guard a call:

- `storage.ts` — replaces `window.localStorage` with a Preferences-backed store
  before React mounts. WKWebView's localStorage can be evicted when the device
  is low on space; conversations should not be.
- `network.ts` — binds the chat store's `online` flag to the radio, so the
  outbox and retry queue are real rather than simulated.
- `camera.ts` — returns a `File`, so `sendAttachment` never learns a camera was
  involved.
- `push.ts` — APNs registration and notification routing.
- `haptics.ts`, `shell.ts` — feedback, status bar, keyboard, splash.

## Building for iOS

**None of this works on Windows.** Xcode is macOS-only. What does work here:
the web app, the Capacitor config, the `ios/` project, and the whole UI
reviewed in a browser at 390×844.

The compile happens in CI — `.github/workflows/ios-build.yml` runs `pod
install` and `xcodebuild` on a macOS runner and uploads a Simulator build. On a
Mac:

```bash
npm run sync --workspace mobile   # build + cap sync ios
npm run ios:open --workspace mobile
```

Push notifications additionally need an Apple Developer account, an APNs key
and the Push Notifications capability enabled on the App ID.

## What this does not do yet

There is no chat server and no orders API. Messages persist on the device and
orders are read from the console's seeded records. `transport.ts` and
`src/lib/orders.ts` are the two files that change when those land — see
`docs/superpowers/specs/2026-09-22-ios-app-design.md` for the sequence.
