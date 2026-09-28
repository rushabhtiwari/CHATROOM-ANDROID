import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The app's data directory, in memory. On a device: never evicted, backed up,
 * and — unlike UserDefaults — meant for values of any size.
 */
const files = new Map<string, string>();
let failWrites = false;
let writes: Array<{ path: string; data: string }> = [];
/** When set, writes wait here until released — to observe what is in flight. */
let gate: Promise<void> | null = null;

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      writes.push({ path, data });
      if (gate) await gate;
      if (failWrites) throw new Error('disk full');
      files.set(path, data);
      return { uri: path };
    },
    readFile: async ({ path }: { path: string }) => {
      if (!files.has(path)) throw new Error('File does not exist');
      return { data: files.get(path)! };
    },
    deleteFile: async ({ path }: { path: string }) => {
      if (!files.delete(path)) throw new Error('File does not exist');
    },
    readdir: async ({ path }: { path: string }) => {
      const prefix = `${path}/`;
      const names = [...files.keys()].filter((name) => name.startsWith(prefix));
      if (names.length === 0) throw new Error('Directory does not exist');
      return { files: names.map((name) => ({ name: name.slice(prefix.length), type: 'file' })) };
    },
  },
}));

/** Let queued writes settle. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

const saved = (key: string) => files.get(`kv/${encodeURIComponent(key)}.txt`);

describe('installDurableStorage', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    files.clear();
    writes = [];
    failWrites = false;
    gate = null;
    original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    vi.resetModules();
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
  });

  async function install(isNative = true) {
    const module = await import('~/native/storage');
    await module.installDurableStorage(isNative);
    return module;
  }

  it('restores what was saved last session before anything reads it', async () => {
    files.set(`kv/${encodeURIComponent('kiranos-chat-v1')}.txt`, '{"version":3}');
    await install();
    // The chat store reads this synchronously on its first render.
    expect(window.localStorage.getItem('kiranos-chat-v1')).toBe('{"version":3}');
  });

  it("mirrors every key the app writes — the web view is the app's alone", async () => {
    await install();
    const keys = [
      'kiranos-chat-v1',
      'nexus-profile-photo:u1',
      'nexus-chat-wallpaper:u1:r1',
      'nexus-locale',
      'kiran_workspace',
      'kiran_hr_leave_v1',
    ];
    for (const key of keys) window.localStorage.setItem(key, `value of ${key}`);
    await settle();
    for (const key of keys) expect(saved(key)).toBe(`value of ${key}`);
  });

  it('survives a restart: written, then read back by a fresh install', async () => {
    await install();
    window.localStorage.setItem('nexus-profile-photo:u1', 'data:image/png;base64,AAAA');
    await settle();
    vi.resetModules();
    await install();
    expect(window.localStorage.getItem('nexus-profile-photo:u1')).toBe(
      'data:image/png;base64,AAAA',
    );
  });

  it('holds a value far larger than a settings store is meant for', async () => {
    await install();
    window.localStorage.setItem('kiranos-chat-v1', 'x'.repeat(5_000_000));
    await settle();
    vi.resetModules();
    await install();
    expect(window.localStorage.getItem('kiranos-chat-v1')?.length).toBe(5_000_000);
  });

  it('writes a burst of saves as the first and the latest, never out of order', async () => {
    await install();
    // The chat store saves its whole snapshot on every change — drafts
    // included, so every keystroke. While one write is on disk, only the
    // newest value waits behind it; the ones in between are never written.
    let release!: () => void;
    gate = new Promise((resolve) => (release = resolve));
    for (let i = 1; i <= 50; i++) window.localStorage.setItem('kiranos-chat-v1', `v${i}`);
    await settle();
    expect(writes.map((w) => w.data)).toEqual(['v1']);

    gate = null;
    release();
    await settle();
    expect(writes.map((w) => w.data)).toEqual(['v1', 'v50']);
    expect(saved('kiranos-chat-v1')).toBe('v50');
  });

  it('mirrors removals, including one queued behind a write', async () => {
    files.set(`kv/${encodeURIComponent('nexus-locale')}.txt`, 'hi');
    await install();
    window.localStorage.setItem('nexus-locale', 'en');
    window.localStorage.removeItem('nexus-locale');
    await settle();
    expect(saved('nexus-locale')).toBeUndefined();
    expect(window.localStorage.getItem('nexus-locale')).toBeNull();
  });

  it('clears everything it holds', async () => {
    await install();
    window.localStorage.setItem('a', '1');
    window.localStorage.setItem('b', '2');
    await settle();
    window.localStorage.clear();
    await settle();
    expect(window.localStorage.length).toBe(0);
    expect(saved('a')).toBeUndefined();
    expect(saved('b')).toBeUndefined();
  });

  it('behaves like Storage for the code that reads it', async () => {
    await install();
    const storage = window.localStorage;
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    expect(storage.length).toBe(2);
    expect([storage.key(0), storage.key(1)].sort()).toEqual(['a', 'b']);
    expect(storage.key(5)).toBeNull();
    expect(storage.getItem('missing')).toBeNull();
    storage.setItem('n', 42 as unknown as string);
    expect(storage.getItem('n')).toBe('42');
  });

  it('records a failed write instead of losing it silently', async () => {
    const module = await install();
    failWrites = true;
    window.localStorage.setItem('kiranos-chat-v1', 'x');
    await settle();
    expect(module.storageError()).toBeInstanceOf(Error);
    expect(window.localStorage.getItem('kiranos-chat-v1')).toBe('x');
  });

  it('leaves the browser alone on the web', async () => {
    const before = window.localStorage;
    await install(false);
    expect(window.localStorage).toBe(before);
  });
});

describe('storage health', () => {
  beforeEach(() => {
    files.clear();
    writes = [];
    failWrites = false;
    gate = null;
    vi.resetModules();
  });

  it('announces a failed save, so the app can stop saying "Healthy"', async () => {
    const module = await import('~/native/storage');
    await module.installDurableStorage(true);
    const heard: unknown[] = [];
    const off = module.onStorageFailure((error) => heard.push(error));

    failWrites = true;
    window.localStorage.setItem('kiranos-chat-v1', 'x');
    await settle();
    expect(heard).toHaveLength(1);
    expect(heard[0]).toBeInstanceOf(Error);

    off();
    window.localStorage.setItem('kiranos-chat-v1', 'y');
    await settle();
    expect(heard).toHaveLength(1);
  });

  it('clears the failure once a save succeeds again', async () => {
    const module = await import('~/native/storage');
    await module.installDurableStorage(true);
    failWrites = true;
    window.localStorage.setItem('kiranos-chat-v1', 'x');
    await settle();
    expect(module.storageError()).not.toBeNull();

    failWrites = false;
    window.localStorage.setItem('kiranos-chat-v1', 'y');
    await settle();
    expect(module.storageError()).toBeNull();
  });

  it('announces recovery once, when a save succeeds after a failure', async () => {
    const module = await import('~/native/storage');
    await module.installDurableStorage(true);
    const heard: unknown[] = [];
    module.onStorageFailure((error) => heard.push(error));

    window.localStorage.setItem('a', '1');
    await settle();
    failWrites = true;
    window.localStorage.setItem('a', '2');
    await settle();
    failWrites = false;
    window.localStorage.setItem('a', '3');
    await settle();
    window.localStorage.setItem('a', '4');
    await settle();

    expect(heard.map((e) => (e === null ? 'recovered' : 'failed'))).toEqual([
      'failed',
      'recovered',
    ]);
  });
});
