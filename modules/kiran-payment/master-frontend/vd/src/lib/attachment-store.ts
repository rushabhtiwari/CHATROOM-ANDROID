/**
 * Out-of-band attachment storage.
 *
 * Attachments used to be inlined into the localStorage snapshot as base64. A
 * single 15 MB upload is roughly 20 MB once encoded — four times the whole
 * ~5 MB localStorage budget — so one photo pushed the snapshot over quota and
 * every subsequent write failed silently, taking the entire workspace with it
 * on the next reload.
 *
 * Binary now lives in IndexedDB, which is sized in hundreds of megabytes and
 * stores Blobs without an encoding tax. The snapshot carries only `blobId`;
 * `Attachment.dataUrl` becomes a runtime-only object URL, rehydrated on boot.
 *
 * Everything here degrades rather than throws. When IndexedDB is unavailable
 * (SSR, private mode, jsdom) the callers fall back to inlining small files and
 * refuse large ones with an explanation, which is the honest failure.
 */

const DB_NAME = "nexus-chat-attachments";
const DB_VERSION = 1;
const STORE = "blobs";

/**
 * Files at or below this size stay inline in the snapshot. Small enough that a
 * normal workspace of them still fits in localStorage, so tiny images survive
 * even when IndexedDB is blocked.
 */
export const INLINE_ATTACHMENT_LIMIT = 256_000;

/** Hard ceiling on any single upload. */
export const MAX_ATTACHMENT_BYTES = 15_000_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Blobs written since this page loaded. The orphan sweep never deletes these.
 *
 * The chat store sweeps five seconds after boot, judging "in use" against the
 * messages as they stood at boot, so a photo sent in those five seconds was
 * deleted while its message still referenced it — a broken image after the
 * next reload. A blob written this session cannot be an orphan left from an
 * earlier one, which is all the sweep exists to remove; this also closes the
 * gap where a blob is written just before its message is committed.
 */
const writtenThisSession = new Set<string>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function blobStoreAvailable(): Promise<boolean> {
  return (await openDb()) !== null;
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    let request: IDBRequest<T>;
    try {
      request = body(db.transaction(STORE, mode).objectStore(STORE));
    } catch {
      resolve(null);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * Records hold the raw bytes rather than the Blob itself. Blob support in
 * IndexedDB is uneven across engines, and an ArrayBuffer survives structured
 * clone everywhere — including in tests, which is how this layer stays
 * verifiable at all.
 */
interface StoredBlob {
  type: string;
  bytes: ArrayBuffer;
}

/**
 * Structural, not `instanceof`: a value that has been through structured clone
 * can come back bound to a different realm's ArrayBuffer, where `instanceof`
 * is false for a perfectly good buffer.
 */
function isStoredBlob(value: unknown): value is StoredBlob {
  if (typeof value !== "object" || value === null || !("bytes" in value)) return false;
  const bytes = (value as StoredBlob).bytes as { byteLength?: unknown };
  return typeof bytes?.byteLength === "number";
}

/** Returns false when the write failed — quota, or no store at all. */
export async function putAttachmentBlob(id: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  let record: StoredBlob;
  try {
    record = { type: blob.type, bytes: await blob.arrayBuffer() };
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(STORE, "readwrite");
    } catch {
      resolve(false);
      return;
    }
    transaction.objectStore(STORE).put(record, id);
    transaction.oncomplete = () => {
      writtenThisSession.add(id);
      resolve(true);
    };
    // QuotaExceededError surfaces on the transaction, not on the put request.
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
}

export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const value = await run<unknown>(db, "readonly", (store) => store.get(id));
  if (!isStoredBlob(value)) return null;
  return new Blob([value.bytes], { type: value.type });
}

export async function deleteAttachmentBlob(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, "readwrite", (store) => store.delete(id));
  revokeAttachmentUrl(id);
}

export async function listAttachmentBlobIds(): Promise<string[]> {
  const db = await openDb();
  if (!db) return [];
  const keys = await run<IDBValidKey[]>(db, "readonly", (store) => store.getAllKeys());
  return (keys ?? []).map(String);
}

/* -------------------------------------------------------------------------- */
/* Object URLs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One object URL per blob for the life of the document. Minting a fresh URL on
 * every render would leak a reference each time; revoking eagerly would break
 * an <img> that is still on screen.
 */
const urlCache = new Map<string, string>();

export function cachedAttachmentUrl(id: string): string | undefined {
  return urlCache.get(id);
}

/** Resolves to an object URL, or null when the blob is gone. */
export async function attachmentUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

/** Registers a URL created elsewhere (a fresh upload) under its blob id. */
export function rememberAttachmentUrl(id: string, url: string): void {
  const previous = urlCache.get(id);
  if (previous && previous !== url) URL.revokeObjectURL(previous);
  urlCache.set(id, url);
}

export function revokeAttachmentUrl(id: string): void {
  const url = urlCache.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** Estimated bytes held in the blob store, for the storage banner. */
export async function attachmentStoreSize(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  const values = await run<unknown[]>(db, "readonly", (store) => store.getAll());
  return (values ?? []).reduce<number>(
    (total, value) => total + (isStoredBlob(value) ? value.bytes.byteLength : 0),
    0,
  );
}

/**
 * Drops blobs no live message references any more — deleted messages, or a
 * snapshot that failed to save after the blob was already written.
 */
export async function collectOrphanBlobs(liveIds: Iterable<string>): Promise<number> {
  const live = new Set([...liveIds, ...writtenThisSession]);
  const stored = await listAttachmentBlobIds();
  const orphans = stored.filter((id) => !live.has(id));
  for (const id of orphans) await deleteAttachmentBlob(id);
  return orphans.length;
}

/** Test seam: forget the cached connection so a fake IDB can be installed. */
export function resetAttachmentStore(): void {
  for (const id of [...urlCache.keys()]) revokeAttachmentUrl(id);
  dbPromise = null;
}
