/**
 * Durable storage for everything the app keeps in `localStorage`.
 *
 * The chat store reads `window.localStorage` directly (chat-store.tsx, where
 * it parses the saved snapshot) and `writeSnapshot` writes to it. There is no
 * injection point, and adding one would mean editing the console — so this
 * replaces the object itself, before anything reads it.
 *
 * Why replace it at all: on iOS, WKWebView's localStorage lives in website
 * data the system may clear when the device is short of space. A user losing
 * every conversation because they installed a large app is not a tradeoff
 * worth making. Each key is instead a file in the app's data directory, which
 * iOS never evicts and includes in backups.
 *
 * Files rather than `@capacitor/preferences`: Preferences is UserDefaults,
 * which Apple intends for small values and loads whole into memory at launch,
 * while the chat snapshot alone can approach the ~5 MB the store budgets for.
 *
 * The shape of the problem: localStorage is synchronous and the file system is
 * not. This resolves it by reading every key into memory once at startup — the
 * one place an await is possible — then serving reads from memory while
 * mirroring writes back to disk. A failed write surfaces through
 * `storageError` and `onStorageFailure` rather than vanishing.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

/*
 * Every key is mirrored. An earlier version kept an allow-list of "this app's"
 * prefixes, which missed most of what the console actually writes — profile
 * photos (`nexus-profile-photo:*`), chat wallpapers, the language choice
 * (`nexus-locale`) and the underscore-named `kiran_*` keys — and so would have
 * let iOS evict them. In a Capacitor app the web view belongs to this app
 * alone; there are no other keys to keep out.
 */

const FOLDER = 'kv';
const EXTENSION = '.txt';

/** Keys are arbitrary strings; file names are not. `:` alone would break some. */
const pathFor = (key: string) => `${FOLDER}/${encodeURIComponent(key)}${EXTENSION}`;
const keyFor = (name: string) => decodeURIComponent(name.slice(0, -EXTENSION.length));

type Op = { kind: 'set'; value: string } | { kind: 'remove' };
type Queue = { busy: boolean; next?: Op };

/** Called with the error on failure, and with null when saving recovers. */
type FailureListener = (error: unknown) => void;
const listeners = new Set<FailureListener>();

class FileBackedStorage implements Storage {
  private readonly cache = new Map<string, string>();

  /**
   * Per key: whether a write is on disk right now, and the newest operation
   * waiting behind it. The chat store rewrites its whole snapshot on every
   * change — drafts included, so on every keystroke — and writing each of
   * those out would queue megabytes of work that is stale before it starts.
   * Only the newest waits; the ones in between are dropped unwritten. It also
   * means an older write can never land after a newer one.
   */
  private readonly queues = new Map<string, Queue>();

  /**
   * Whether the device copy is currently behind the in-memory one: the error
   * from the most recent write, or null once a write succeeds again.
   */
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
    const text = String(value);
    this.cache.set(key, text);
    this.schedule(key, { kind: 'set', value: text });
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    this.schedule(key, { kind: 'remove' });
  }

  clear(): void {
    for (const key of [...this.cache.keys()]) this.removeItem(key);
  }

  private schedule(key: string, op: Op) {
    const queue = this.queues.get(key) ?? { busy: false };
    this.queues.set(key, queue);
    if (queue.busy) {
      queue.next = op;
      return;
    }
    void this.run(key, queue, op);
  }

  private async run(key: string, queue: Queue, op: Op) {
    queue.busy = true;
    for (let current: Op | undefined = op; current;) {
      try {
        if (current.kind === 'set') {
          await Filesystem.writeFile({
            path: pathFor(key),
            data: current.value,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
            recursive: true,
          });
        } else {
          // Already absent is fine: the removal has had its effect.
          await Filesystem.deleteFile({ path: pathFor(key), directory: Directory.Data }).catch(
            () => {},
          );
        }
        this.report(null);
      } catch (error) {
        this.report(error);
      }
      current = queue.next;
      queue.next = undefined;
    }
    queue.busy = false;
  }

  /** Record how the latest write went, and announce a change of state. */
  private report(error: unknown) {
    if (error === null) {
      if (this.lastError === null) return;
      this.lastError = null;
      for (const listener of listeners) listener(null);
      return;
    }
    this.lastError = error;
    for (const listener of listeners) listener(error);
  }
}

let installed: FileBackedStorage | null = null;

async function readAll(): Promise<Array<[string, string]>> {
  let names: string[];
  try {
    const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Data });
    names = files.map((file) => file.name).filter((name) => name.endsWith(EXTENSION));
  } catch {
    return []; // First launch: nothing saved yet.
  }
  const entries = await Promise.all(
    names.map(async (name): Promise<[string, string] | null> => {
      try {
        const { data } = await Filesystem.readFile({
          path: `${FOLDER}/${name}`,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        return [keyFor(name), String(data)];
      } catch {
        return null; // One unreadable file must not cost every other key.
      }
    }),
  );
  return entries.filter((entry): entry is [string, string] => entry !== null);
}

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
  installed = new FileBackedStorage(await readAll());
  Object.defineProperty(window, 'localStorage', {
    value: installed,
    configurable: true,
  });
}

/** The current persistence failure, if the durable store is in use. */
export const storageError = () => installed?.lastError ?? null;

/**
 * Hear about a failed save, and about recovering from one (with null).
 *
 * The chat store cannot see these: its own save goes to this shim's memory,
 * which always succeeds, so it would go on reporting a healthy workspace while
 * nothing reached the device. Returns an unsubscribe function.
 */
export function onStorageFailure(listener: FailureListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
