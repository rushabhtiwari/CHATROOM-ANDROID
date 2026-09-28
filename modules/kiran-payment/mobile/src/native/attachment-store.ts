/**
 * Attachment storage that iOS will not clear.
 *
 * The console keeps attachment bytes in IndexedDB (`@/lib/attachment-store`).
 * In a Capacitor app IndexedDB lives in WKWebView's website data, which iOS
 * may evict when the device runs short of space — the conversation survives
 * (the shim in `storage.ts` makes sure of that) but every photo in it would
 * turn into a broken image.
 *
 * On a device this module replaces that one: same exports, same behaviour,
 * but each attachment is a file in the app's own data directory, which iOS
 * never evicts and includes in backups. The chat store is pointed here by a
 * resolver in vite.config.ts, so the console's code is not edited. In a
 * browser every export is simply the console's own implementation.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import * as web from '@/lib/attachment-store';
import { isNative } from '~/native/platform';

export { INLINE_ATTACHMENT_LIMIT, MAX_ATTACHMENT_BYTES } from '@/lib/attachment-store';

const FOLDER = 'attachments';
const EXTENSION = '.json';

/**
 * One file per attachment. Ids are encoded rather than trusted as file names:
 * `a/b` would otherwise be a path, and two ids that differ only in a character
 * the file system rewrites would collide.
 */
const pathFor = (id: string) => `${FOLDER}/${encodeURIComponent(id)}${EXTENSION}`;
const idFor = (name: string) => decodeURIComponent(name.slice(0, -EXTENSION.length));

/** What a file holds: the bytes, and the type the Blob needs back. */
interface Stored {
  type: string;
  data: string;
}

/** Base64, in chunks: one `String.fromCharCode(...bytes)` of 15 MB overflows the stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  // Backed by a plain ArrayBuffer, which is what a Blob accepts; the default
  // Uint8Array type admits a SharedArrayBuffer, which it does not.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function listFiles(): Promise<Array<{ name: string; size: number }>> {
  try {
    const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Data });
    return files.filter((file) => file.name.endsWith(EXTENSION));
  } catch {
    // No folder yet: nothing has been stored.
    return [];
  }
}

const device = {
  async blobStoreAvailable(): Promise<boolean> {
    return true;
  },

  /** Returns false when the write failed, which the chat store reports. */
  async putAttachmentBlob(id: string, blob: Blob): Promise<boolean> {
    try {
      const stored: Stored = {
        type: blob.type,
        data: toBase64(new Uint8Array(await blob.arrayBuffer())),
      };
      await Filesystem.writeFile({
        path: pathFor(id),
        data: JSON.stringify(stored),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  async getAttachmentBlob(id: string): Promise<Blob | null> {
    try {
      const { data } = await Filesystem.readFile({
        path: pathFor(id),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const stored = JSON.parse(String(data)) as Stored;
      return new Blob([fromBase64(stored.data)], { type: stored.type });
    } catch {
      return null;
    }
  },

  async deleteAttachmentBlob(id: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: pathFor(id), directory: Directory.Data });
    } catch {
      /* already gone */
    }
    device.revokeAttachmentUrl(id);
  },

  async listAttachmentBlobIds(): Promise<string[]> {
    return (await listFiles()).map((file) => idFor(file.name));
  },

  /** Bytes on disk, for the storage banner. Base64 in JSON, so ~4/3 the raw size. */
  async attachmentStoreSize(): Promise<number> {
    return (await listFiles()).reduce((total, file) => total + (file.size ?? 0), 0);
  },

  async collectOrphanBlobs(liveIds: Iterable<string>): Promise<number> {
    const live = new Set(liveIds);
    const orphans = (await device.listAttachmentBlobIds()).filter((id) => !live.has(id));
    for (const id of orphans) await device.deleteAttachmentBlob(id);
    return orphans.length;
  },

  /* Object URLs — the console's rules: one per blob for the life of the page. */

  urls: new Map<string, string>(),

  cachedAttachmentUrl(id: string): string | undefined {
    return device.urls.get(id);
  },

  async attachmentUrl(id: string): Promise<string | null> {
    const cached = device.urls.get(id);
    if (cached) return cached;
    const blob = await device.getAttachmentBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    device.urls.set(id, url);
    return url;
  },

  rememberAttachmentUrl(id: string, url: string): void {
    const previous = device.urls.get(id);
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    device.urls.set(id, url);
  },

  revokeAttachmentUrl(id: string): void {
    const url = device.urls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    device.urls.delete(id);
  },

  resetAttachmentStore(): void {
    for (const id of [...device.urls.keys()]) device.revokeAttachmentUrl(id);
  },
};

const impl = isNative ? device : web;

/**
 * Attachments written since launch. The sweep never deletes these.
 *
 * The chat store sweeps orphans five seconds after boot, judging "in use"
 * against the messages as they stood at boot. Anything sent in those five
 * seconds is absent from that list, so its bytes were deleted while its
 * message still referenced them — a broken image after the next restart.
 * Opening the app from a share sheet and sending a photo straight away is the
 * ordinary way to hit it. A blob written this session is by definition not
 * an orphan from an earlier one, which is all the sweep exists to remove; it
 * also closes the smaller gap the store itself notes, where a blob is written
 * just before its message is committed.
 *
 * This wraps both paths, so the browser build is fixed too. The console's own
 * app has the same bug in its store; it is not edited from here.
 */
const writtenThisSession = new Set<string>();

export const putAttachmentBlob = async (id: string, blob: Blob): Promise<boolean> => {
  const stored = await impl.putAttachmentBlob(id, blob);
  if (stored) writtenThisSession.add(id);
  return stored;
};

export const collectOrphanBlobs = (liveIds: Iterable<string>): Promise<number> =>
  impl.collectOrphanBlobs([...liveIds, ...writtenThisSession]);

export const blobStoreAvailable = impl.blobStoreAvailable;
export const getAttachmentBlob = impl.getAttachmentBlob;
export const deleteAttachmentBlob = impl.deleteAttachmentBlob;
export const listAttachmentBlobIds = impl.listAttachmentBlobIds;
export const attachmentStoreSize = impl.attachmentStoreSize;
export const cachedAttachmentUrl = impl.cachedAttachmentUrl;
export const attachmentUrl = impl.attachmentUrl;
export const rememberAttachmentUrl = impl.rememberAttachmentUrl;
export const revokeAttachmentUrl = impl.revokeAttachmentUrl;
export const resetAttachmentStore = impl.resetAttachmentStore;
