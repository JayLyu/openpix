const DB_NAME = "openpix";
const DB_VERSION = 1;
const STORE_NAME = "record_images";

export type StoredRecordImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB 不可用"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        reject(request.error ?? new Error("无法打开 IndexedDB"));
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => {
          reject(request.error ?? new Error("IndexedDB 操作失败"));
        };
      }),
  );
}

async function sourceToBlob(source: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("无法读取图片数据");
  }
  return response.blob();
}

export async function saveRecordImage(
  recordId: string,
  source: string,
): Promise<void> {
  const blob = await sourceToBlob(source);
  const entry: StoredRecordImage = {
    id: recordId,
    blob,
    mimeType: blob.type || "image/png",
    size: blob.size,
    createdAt: Date.now(),
  };
  await runTransaction("readwrite", (store) => store.put(entry));
}

export async function getRecordImageBlob(
  recordId: string,
): Promise<Blob | null> {
  try {
    const entry = await runTransaction<StoredRecordImage | undefined>(
      "readonly",
      (store) => store.get(recordId),
    );
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

export async function hasRecordImage(recordId: string): Promise<boolean> {
  const blob = await getRecordImageBlob(recordId);
  return blob != null;
}

export async function deleteRecordImage(recordId: string): Promise<void> {
  try {
    await runTransaction("readwrite", (store) => store.delete(recordId));
  } catch {
    // ignore missing entries
  }
}

export async function clearAllRecordImages(): Promise<void> {
  try {
    await runTransaction("readwrite", (store) => store.clear());
  } catch {
    // ignore when db never opened
  }
}

async function iterateRecordImages(
  onEntry: (entry: StoredRecordImage) => void,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const value = cursor.value as StoredRecordImage | undefined;
      if (value) onEntry(value);
      cursor.continue();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("无法读取 IndexedDB"));
    };
  });
}

export async function getRecordImagesCount(): Promise<number> {
  try {
    let count = 0;
    await iterateRecordImages(() => {
      count += 1;
    });
    return count;
  } catch {
    return 0;
  }
}

export async function getRecordImagesTotalBytes(): Promise<number> {
  try {
    let total = 0;
    await iterateRecordImages((entry) => {
      total += entry.size ?? entry.blob?.size ?? 0;
    });
    return total;
  } catch {
    return 0;
  }
}
