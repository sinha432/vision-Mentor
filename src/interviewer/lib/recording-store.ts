/**
 * Local-only storage for interview webcam recordings. Clips live in IndexedDB
 * on the candidate's device and are never uploaded anywhere. Only the most
 * recent few sessions are kept.
 */

const DB_NAME = "vmx.recordings";
const STORE = "clips";
const KEEP = 3;

interface ClipRow {
  id: string;
  blob: Blob;
  createdAt: number;
}

function open(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const store = db.transaction(STORE, mode).objectStore(STORE);
          const request = run(store);
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function saveRecording(id: string, blob: Blob): Promise<boolean> {
  const row: ClipRow = { id, blob, createdAt: Date.now() };
  const ok = await tx("readwrite", (store) => store.put(row) as IDBRequest<IDBValidKey>);
  await pruneRecordings();
  return ok !== null;
}

export async function getRecording(id: string): Promise<Blob | null> {
  const row = await tx<ClipRow | undefined>("readonly", (store) => store.get(id));
  return row?.blob ?? null;
}

export async function deleteRecording(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

/** Keep only the newest clips so the browser quota never fills up. */
export async function pruneRecordings(): Promise<void> {
  const rows = await tx<ClipRow[]>("readonly", (store) => store.getAll());
  if (!rows || rows.length <= KEEP) return;
  const stale = [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(KEEP);
  for (const row of stale) await deleteRecording(row.id);
}
