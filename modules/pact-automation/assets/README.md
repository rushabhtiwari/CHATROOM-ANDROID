# assets

Drop files here to brand KPAC. Both are optional — the console works without them.

- `logo.png` — a square PNG (64×64 or larger). The top bar uses it automatically and falls back
  to the "KP" wordmark when it is absent.
- `ui-reference.png` — a screenshot of the look you want KPAC to match. It is not read at runtime;
  it is a reference for whoever restyles `server/static/index.html`. The palette lives in the
  `:root` custom properties at the top of that file, so matching a new design usually means
  changing those tokens rather than the markup.
