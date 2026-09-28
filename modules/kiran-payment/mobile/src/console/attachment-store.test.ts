import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The console's own attachment store — the IndexedDB one the desktop console
 * uses, and the one the mobile app delegates to in a browser. Tested here
 * because the console has no test runner of its own and this one already
 * compiles its source.
 */
const load = async () => {
  vi.resetModules();
  return import('@/lib/attachment-store');
};
const photo = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

beforeEach(() => {
  // A fresh, empty IndexedDB per test. Deleting one database between tests
  // blocks behind the connection the last test left open, and every later
  // open then queues behind the blocked delete.
  vi.stubGlobal('indexedDB', new IDBFactory());
});

describe("the console's attachment store", () => {
  it('never sweeps an attachment written this session', async () => {
    // The chat store sweeps five seconds after boot, judging "in use" against
    // the messages as they stood at boot. A photo sent in those five seconds
    // was deleted while its message still referenced it.
    const store = await load();
    expect(await store.putAttachmentBlob('sent-just-now', photo())).toBe(true);
    expect(await store.collectOrphanBlobs([])).toBe(0);
    expect(await store.getAttachmentBlob('sent-just-now')).not.toBeNull();
  });

  it('still sweeps a genuine orphan from an earlier session', async () => {
    const first = await load();
    await first.putAttachmentBlob('from-last-session', photo());
    first.resetAttachmentStore();
    const next = await load();
    expect(await next.collectOrphanBlobs([])).toBe(1);
    expect(await next.listAttachmentBlobIds()).toEqual([]);
  });
});
