/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the Python API lives.
   *
   * Empty on the web, where Vite proxies /api and /uploads to it on the same
   * origin. On a device there is no proxy and no same origin — the app is
   * served from capacitor://localhost — so a build for iOS must set this to an
   * absolute origin the phone can reach.
   */
  readonly VITE_API_ORIGIN?: string;
  /**
   * 'true' when the Android build includes a Firebase `google-services.json`.
   * Android push registration crashes without one, so it is skipped unless
   * this is set. iOS ignores it.
   */
  readonly VITE_ANDROID_PUSH?: string;
  /**
   * 'true' for a build with no backend: the app answers its own `/api`
   * requests (src/local). The keys below are only read in that mode, and are
   * baked in by scripts/build-standalone.mjs from the backend's .env.
   */
  readonly VITE_STANDALONE?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_BASE_URL?: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_OPENAI_EXTRACTION_MODEL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
  readonly VITE_GOOGLE_REFRESH_TOKEN?: string;
  readonly VITE_GOOGLE_CALENDAR_REFRESH_TOKEN?: string;
  readonly VITE_GOOGLE_MEET_REFRESH_TOKEN?: string;
  readonly VITE_RTS_TIME_ZONE?: string;
  readonly VITE_RTS_ENFORCE_BUDGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
