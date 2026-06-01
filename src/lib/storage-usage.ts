import {
  getRecordImagesCount,
  getRecordImagesTotalBytes,
} from "@/lib/image-store";

const OPENPIX_KEY_PREFIX = "openpix_";
const OPENPIX_PRESERVED_KEYS = new Set(["openpix_theme"]);

function estimateLocalStorageEntryBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

export type OpenPixStorageBreakdown = {
  localStorageBytes: number;
  indexedDbBytes: number;
  indexedDbImageCount: number;
  totalBytes: number;
};

function getOpenPixLocalStorageBytes(): number {
  if (typeof window === "undefined") return 0;

  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(OPENPIX_KEY_PREFIX)) continue;
    if (OPENPIX_PRESERVED_KEYS.has(key)) continue;
    const value = localStorage.getItem(key);
    if (value == null) continue;
    total += estimateLocalStorageEntryBytes(key, value);
  }
  return total;
}

export async function getOpenPixStorageBreakdown(): Promise<OpenPixStorageBreakdown> {
  const [localStorageBytes, indexedDbBytes, indexedDbImageCount] =
    await Promise.all([
      Promise.resolve(getOpenPixLocalStorageBytes()),
      getRecordImagesTotalBytes(),
      getRecordImagesCount(),
    ]);
  return {
    localStorageBytes,
    indexedDbBytes,
    indexedDbImageCount,
    totalBytes: localStorageBytes + indexedDbBytes,
  };
}

export async function getOpenPixStorageBytes(): Promise<number> {
  const breakdown = await getOpenPixStorageBreakdown();
  return breakdown.totalBytes;
}

export function formatOpenPixStorageOccupancy(bytes: number): string {
  if (bytes <= 0) return "0 KB";

  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) {
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }

  const kb = bytes / 1024;
  if (kb < 1) return "不足 1 KB";
  return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}

export async function clearOpenPixCache(): Promise<void> {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(OPENPIX_KEY_PREFIX) && !OPENPIX_PRESERVED_KEYS.has(key)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  const { clearAllRecordImages } = await import("@/lib/image-store");
  await clearAllRecordImages();
}
