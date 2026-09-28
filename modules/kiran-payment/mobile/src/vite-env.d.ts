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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
