// Original files belong in IndexedDB, not JSON/localStorage or image thumbnails.
export const ARTWORK_ACCEPT = ".pdf,.ai,.cdr,.jpg,.jpeg,.png";
// Leave room for multipart framing below the existing hosted upload route's 4.5 MB limit.
export const ARTWORK_MAX_BYTES = 4 * 1024 * 1024;
const DATABASE = "elev8-cart-artwork";
const FILES = "files";
const STORAGE_ERROR = "Your browser could not save or open this artwork. Allow site storage or try another browser, then attach the file again.";

interface StoredArtwork {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
}

export function isArtworkFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function validateArtwork(file: File): void {
  if (!isArtworkFile(file) || !/\.(pdf|ai|cdr|jpe?g|png)$/i.test(file.name)) {
    throw new Error("Choose a PDF, AI, CDR, JPG or PNG artwork file.");
  }
  if (file.size === 0 || file.size > ARTWORK_MAX_BYTES) {
    throw new Error("Choose an artwork file larger than 0 bytes and no bigger than 4 MB.");
  }
}

export function artworkPreview(file: File): string | null {
  return /\.(png|jpe?g)$/i.test(file.name) ? URL.createObjectURL(file) : null;
}

export function releaseArtworkPreview(url?: string | null): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function expectsArtwork(item: { artworkExpected?: boolean; artworkId?: string | null; artworkName?: string | null; designFileId?: unknown; previewUrl?: string | null }): boolean {
  return Boolean(item.artworkExpected || item.artworkId || item.artworkName || item.designFileId || item.previewUrl);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error(STORAGE_ERROR)); return; }
    const request = indexedDB.open(DATABASE, 1);
    let rejected = false;
    request.onupgradeneeded = () => request.result.createObjectStore(FILES);
    request.onerror = request.onblocked = () => { rejected = true; reject(new Error(STORAGE_ERROR)); };
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
  });
}

async function fileTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(FILES, mode);
      const request = action(transaction.objectStore(FILES));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      // A successful request can still be followed by a failed/aborted commit.
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error(STORAGE_ERROR)); };
    } catch {
      db.close();
      reject(new Error(STORAGE_ERROR));
    }
  });
}

export async function saveCartArtwork(id: string, file: File): Promise<void> {
  validateArtwork(file);
  const record: StoredArtwork = { blob: file, name: file.name, type: file.type, lastModified: file.lastModified };
  await fileTransaction("readwrite", (store) => store.put(record, id));
}

export async function readCartArtwork(id: string): Promise<File | null> {
  const record = await fileTransaction<StoredArtwork | undefined>("readonly", (store) => store.get(id));
  if (!record) return null;
  if (!(record.blob instanceof Blob) || typeof record.name !== "string") throw new Error(STORAGE_ERROR);
  const file = new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified });
  validateArtwork(file);
  return file;
}

export async function deleteCartArtwork(id: string): Promise<void> {
  await fileTransaction("readwrite", (store) => store.delete(id));
}
