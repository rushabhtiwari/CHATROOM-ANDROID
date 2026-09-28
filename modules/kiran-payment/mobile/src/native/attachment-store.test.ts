import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The app's data folder, in memory. On a device: never evicted, backed up. */
const files = new Map<string, string>();
let failWrites = false;

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: async ({ path, data }: { path: string; data: string }) => {
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
      const entries = [...files.entries()].filter(([name]) => name.startsWith(prefix));
      if (entries.length === 0 && !files.has(`${path}/.keep`)) {
        throw new Error('Directory does not exist');
      }
      return {
        files: entries.map(([name, data]) => ({
          name: name.slice(prefix.length),
          size: data.length,
          type: 'file',
        })),
      };
    },
  },
}));

vi.mock('~/native/platform', () => ({ isNative: true, isIOS: true, platform: 'ios' }));

const store = await import('~/native/attachment-store');

const photo = () =>
  new Blob([new Uint8Array([137, 80, 78, 71, 0, 255, 1, 2])], { type: 'image/png' });
const bytes = async (blob: Blob) => [...new Uint8Array(await blob.arrayBuffer())];

beforeEach(() => {
  files.clear();
  failWrites = false;
  store.resetAttachmentStore();
});

describe('attachment store on a device', () => {
  it('is available without IndexedDB', async () => {
    expect(await store.blobStoreAvailable()).toBe(true);
  });

  it('round-trips the exact bytes and type', async () => {
    expect(await store.putAttachmentBlob('b-1', photo())).toBe(true);
    const back = await store.getAttachmentBlob('b-1');
    expect(back?.type).toBe('image/png');
    expect(await bytes(back!)).toEqual([137, 80, 78, 71, 0, 255, 1, 2]);
  });

  it('keeps ids that are not safe file names apart', async () => {
    await store.putAttachmentBlob('a/b', new Blob(['one']));
    await store.putAttachmentBlob('a_b', new Blob(['two']));
    expect(await (await store.getAttachmentBlob('a/b'))!.text()).toBe('one');
    expect(await (await store.getAttachmentBlob('a_b'))!.text()).toBe('two');
    expect((await store.listAttachmentBlobIds()).sort()).toEqual(['a/b', 'a_b']);
  });

  it('reports a failed write as false, as the chat store expects', async () => {
    failWrites = true;
    expect(await store.putAttachmentBlob('b-1', photo())).toBe(false);
  });

  it('returns null for a missing attachment rather than throwing', async () => {
    expect(await store.getAttachmentBlob('nope')).toBeNull();
    expect(await store.attachmentUrl('nope')).toBeNull();
  });

  it('lists, deletes and sizes what it holds', async () => {
    expect(await store.listAttachmentBlobIds()).toEqual([]);
    expect(await store.attachmentStoreSize()).toBe(0);
    await store.putAttachmentBlob('b-1', photo());
    await store.putAttachmentBlob('b-2', photo());
    expect(await store.attachmentStoreSize()).toBeGreaterThan(0);
    await store.deleteAttachmentBlob('b-1');
    expect(await store.listAttachmentBlobIds()).toEqual(['b-2']);
    await store.deleteAttachmentBlob('never-existed'); // must not throw
  });

  it('drops only the blobs no message references', async () => {
    // Orphans are left over from an earlier launch; this session's own writes
    // are protected (see below), so write them, then start a new session.
    for (const id of ['keep', 'orphan-1', 'orphan-2']) await store.putAttachmentBlob(id, photo());
    vi.resetModules();
    const nextLaunch = await import('~/native/attachment-store');
    expect(await nextLaunch.collectOrphanBlobs(['keep'])).toBe(2);
    expect(await nextLaunch.listAttachmentBlobIds()).toEqual(['keep']);
  });

  it('mints one object URL per attachment and reuses it', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await store.putAttachmentBlob('b-1', photo());
    expect(await store.attachmentUrl('b-1')).toBe('blob:one');
    expect(await store.attachmentUrl('b-1')).toBe('blob:one');
    expect(created).toHaveBeenCalledTimes(1);
    expect(store.cachedAttachmentUrl('b-1')).toBe('blob:one');
    store.revokeAttachmentUrl('b-1');
    expect(store.cachedAttachmentUrl('b-1')).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('survives a restart: a fresh module reads what the last one wrote', async () => {
    await store.putAttachmentBlob('b-1', photo());
    vi.resetModules();
    const fresh = await import('~/native/attachment-store');
    expect(await bytes((await fresh.getAttachmentBlob('b-1'))!)).toEqual([
      137, 80, 78, 71, 0, 255, 1, 2,
    ]);
  });

  it("keeps the console's size limits", async () => {
    const original = await import('../../../master-frontend/vd/src/lib/attachment-store');
    expect(store.INLINE_ATTACHMENT_LIMIT).toBe(original.INLINE_ATTACHMENT_LIMIT);
    expect(store.MAX_ATTACHMENT_BYTES).toBe(original.MAX_ATTACHMENT_BYTES);
  });

  it('never sweeps an attachment written this session', async () => {
    // The chat store sweeps orphans five seconds after boot, judging "in use"
    // against the messages as they were at boot. A photo sent in those five
    // seconds is not in that list — so it was deleted while its message still
    // pointed at it, and came back as a broken image after a restart.
    await store.putAttachmentBlob('sent-just-now', photo());
    expect(await store.collectOrphanBlobs([])).toBe(0);
    expect(await store.getAttachmentBlob('sent-just-now')).not.toBeNull();
  });

  it('still sweeps a genuine orphan left from an earlier session', async () => {
    await store.putAttachmentBlob('from-last-session', photo());
    vi.resetModules();
    const nextLaunch = await import('~/native/attachment-store');
    expect(await nextLaunch.collectOrphanBlobs([])).toBe(1);
    expect(await nextLaunch.listAttachmentBlobIds()).toEqual([]);
  });
});
