# KiranOS for iOS and Android

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

`src/api/install.ts` fixes that from outside the console: at startup it wraps
`fetch` and `EventSource` and sends relative `/api` and `/uploads` paths to
`VITE_API_ORIGIN`. Nothing else is touched, and with the variable unset nothing
is installed. Copy `.env.example` to `.env` and set it before building for a
phone; the backend already allows CORS for `capacitor://localhost`.

To check a device build without a device, build with the variable set and serve
`dist/` from any plain static server — one with no proxy, which is what the
phone has:

```bash
VITE_API_ORIGIN=http://127.0.0.1:3001 npm run build --workspace mobile
```

## Native behaviour

`src/native/` holds every Capacitor adapter, and each one is a no-op on the web
so screens never have to guard a call:

- `storage.ts` — replaces `window.localStorage` before React mounts with a
  store kept as files in the app's data directory. WKWebView's localStorage
  can be evicted when the device is low on space; conversations, profile
  photos and settings should not be. Saves to the same key are coalesced, so a
  keystroke-by-keystroke snapshot does not queue megabytes of stale writes.
- `attachment-store.ts` — the same, for photo attachments, which the console
  keeps in IndexedDB. `vite.config.ts` points the chat store's import here.
- `network.ts` — binds the chat store's `online` flag to the radio, so the
  outbox and retry queue are real rather than simulated.
- `camera.ts` — returns a `File`, so `sendAttachment` never learns a camera was
  involved.
- `push.ts` — APNs registration and notification routing.
- `haptics.ts`, `shell.ts` — feedback, status bar, keyboard, splash.

## Tests

```bash
npm run test --workspace mobile
npm run format:check --workspace mobile
```

The screen tests mount the real `ChatProvider` over its real seed, so sending a
message, inserting a mention or opening a thread goes through the same store the
app uses. Only the network is faked, answered from `src/test/fixtures/state.json`
— a snapshot captured from the real backend. CI runs these on Linux before the
macOS build starts.

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

## Building for Android

The same web app and the same Capacitor plugins, in the `android/` project. The
screens, the chat store and every feature are shared with the iOS build; only
the native shell differs.

The APK is built in CI — `.github/workflows/android-build.yml` runs on Linux
and needs no Android Studio. Every push to `main` that touches the app
publishes the APK as the `android-latest` release, so a phone can download it
directly from:

```
https://github.com/<owner>/<repo>/releases/download/android-latest/KiranOS.apk
```

The server address is baked in the same way as for iOS: the manual run's
`api_origin` input, else the `API_ORIGIN` repository variable. To point the app
at another server, run the workflow from the Actions tab with that address.

Locally, with Android Studio (JDK 21, Android SDK 35) installed:

```bash
npm run sync:android --workspace mobile   # build + cap sync android
npm run android:open --workspace mobile
```

Where Android differs from iOS:

- **Keyboard.** The theme opts out of Android 15's enforced edge-to-edge
  layout and the activity uses `adjustResize`, so the web view shrinks above
  the keyboard and the composer stays pinned — what iOS gets from the Keyboard
  plugin's native resize mode.
- **Status bar.** Drawn above the web view in the canvas colour (`shell.ts`),
  not over it, because the Android web view does not report a safe-area inset
  for it.
- **Plain http.** `server.androidScheme` is `http`, so the app's origin is
  `http://localhost` (already allowed by the backend's CORS rule) and it may
  call an http server; the manifest allows cleartext, like the iOS ATS
  exception.
- **Push notifications** go through Firebase. Without the project's
  `google-services.json`, registering crashes the app, so `push.ts` skips it
  unless the build was made with one: store the file's contents as the
  `GOOGLE_SERVICES_JSON` repository secret and CI enables push.
- **Signing.** Test builds are signed with `android/app/kiranos-test.p12`
  (password `android`), committed so every build installs over the last. It
  is a test key; sign anything distributed beyond testing with a private one.

## What this does not do yet

There is no chat server and no orders API. Messages persist on the device and
orders are read from the console's seeded records. `transport.ts` and
`src/lib/orders.ts` are the two files that change when those land — see
`docs/superpowers/specs/2026-09-22-ios-app-design.md` for the sequence.
