import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Capacitor Preferences, in memory. On a device this is UserDefaults: durable,
 * backed up, never evicted — which is the whole reason the shim exists.
 */
const prefs = new Map<string, string>();
let failWrites = false;

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    keys: async () => ({ keys: [...prefs.keys()] }),
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      if (failWrites) throw new Error('disk full');
      prefs.set(key, value);
    },
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    clear: async () => prefs.clear(),
  },
}));

/** Let fire-and-forget mirror writes settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('installDurableStorage', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    prefs.clear();
    failWrites = false;
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
    prefs.set('kiranos-chat-v1', '{"version":3}');
    await install();
    // The chat store reads this synchronously on its first render.
    expect(window.localStorage.getItem('kiranos-chat-v1')).toBe('{"version":3}');
  });

  it("mirrors every key the app writes — the web view is the app's alone", async () => {
    await install();
    // Real keys from the console's code. A prefix allow-list missed all but
    // the first: profile photos, wallpapers, the language choice, and the
    // underscore-named workspace keys.
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
    for (const key of keys) expect(prefs.get(key)).toBe(`value of ${key}`);
  });

  it('survives a restart: written, then read back by a fresh install', async () => {
    await install();
    window.localStorage.setItem('nexus-profile-photo:u1', 'data:image/png;base64,AAAA');
    await settle();

    // A new process: the in-memory cache is gone, only Preferences remains.
    vi.resetModules();
    await install();
    expect(window.localStorage.getItem('nexus-profile-photo:u1')).toBe(
      'data:image/png;base64,AAAA',
    );
  });

  it('mirrors removals', async () => {
    prefs.set('nexus-locale', 'hi');
    await install();
    window.localStorage.removeItem('nexus-locale');
    await settle();
    expect(prefs.has('nexus-locale')).toBe(false);
    expect(window.localStorage.getItem('nexus-locale')).toBeNull();
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
    // Storage stores strings, whatever it is given.
    storage.setItem('n', 42 as unknown as string);
    expect(storage.getItem('n')).toBe('42');
  });

  it('records a failed write instead of losing it silently', async () => {
    const module = await install();
    failWrites = true;
    window.localStorage.setItem('kiranos-chat-v1', 'x');
    await settle();
    expect(module.storageError()).toBeInstanceOf(Error);
    // The in-memory copy still serves this session.
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
    prefs.clear();
    failWrites = false;
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

    window.localStorage.setItem('a', '1'); // healthy: nothing to announce
    await settle();
    failWrites = true;
    window.localStorage.setItem('a', '2');
    await settle();
    failWrites = false;
    window.localStorage.setItem('a', '3');
    window.localStorage.setItem('a', '4'); // still healthy: announced once
    await settle();

    expect(heard.map((e) => (e === null ? 'recovered' : 'failed'))).toEqual([
      'failed',
      'recovered',
    ]);
  });
});
