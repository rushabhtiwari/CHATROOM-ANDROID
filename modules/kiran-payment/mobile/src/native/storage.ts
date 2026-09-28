/**
 * Durable storage for the chat snapshot.
 *
 * The chat store reads `window.localStorage` directly (chat-store.tsx, where
 * it parses the saved snapshot) and `writeSnapshot` writes to it. There is no
 * injection point, and adding one would mean editing the console — so this
 * replaces the object itself, before anything reads it.
 *
 * Why replace it at all: on iOS, WKWebView's localStorage lives in a cache
 * the system may clear when the device is short of space. A user losing every
 * conversation because they installed a large app is not a tradeoff worth
 * making. `@capacitor/preferences` is backed by UserDefaults, which is
 * included in device backups and is not evicted.
 *
 * The shape of the problem: localStorage is synchronous and Preferences is
 * not. This resolves it by hydrating every key into memory once at startup —
 * the one place an await is possible — and then serving reads from memory
 * while mirroring writes back to Preferences. Writes are fire-and-forget by
 * necessity; a failure surfaces through `lastError` rather than vanishing.
 */
import { Preferences } from '@capacitor/preferences';

/*
 * Every key is mirrored. An earlier version kept an allow-list of "this app's"
 * prefixes, which missed most of what the console actually writes — profile
 * photos (`nexus-profile-photo:*`), chat wallpapers, the language choice
 * (`nexus-locale`) and the underscore-named `kiran_*` keys — and so would have
 * let iOS evict them. In a Capacitor app the web view belongs to this app
 * alone; there are no other keys to keep out.
 */

class PreferencesBackedStorage implements Storage {
  private readonly cache = new Map<string, string>();

  /** The most recent write failure, for the storage banner to report. */
  lastError: unknown = null;

  constructor(entries: Iterable<[string, string]>) {
    for (const [key, value] of entries) this.cache.set(key, value);
  }

  get length(): number {
    return this.cache.size;
  }

  key(index: number): string | null {
    return [...this.cache.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.cache.has(key) ? (this.cache.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, String(value));
    void Preferences.set({ key, value: String(value) }).catch((error) => {
      this.lastError = error;
    });
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    void Preferences.remove({ key }).catch((error) => {
      this.lastError = error;
    });
  }

  clear(): void {
    this.cache.clear();
    void Preferences.clear().catch((error) => {
      this.lastError = error;
    });
  }
}

let installed: PreferencesBackedStorage | null = null;

/**
 * Swap `window.localStorage` for the durable implementation.
 *
 * Must be awaited before the chat provider mounts: the provider reads the
 * snapshot during its first render, and a read that lands before hydration
 * finishes would report an empty workspace and then overwrite the real one.
 *
 * On the web this is a no-op — the browser's own localStorage is already both
 * synchronous and durable, and swapping it would only add a failure mode.
 */
export async function installDurableStorage(isNative: boolean): Promise<void> {
  if (!isNative || installed) return;

  const { keys } = await Preferences.keys();
  const entries = await Promise.all(
    keys.map(async (key): Promise<[string, string]> => {
      const { value } = await Preferences.get({ key });
      return [key, value ?? ''];
    }),
  );

  installed = new PreferencesBackedStorage(entries);
  Object.defineProperty(window, 'localStorage', {
    value: installed,
    configurable: true,
  });
}

/** The most recent persistence failure, if the durable store is in use. */
export const storageError = () => installed?.lastError ?? null;
