import { deleteRecordImage, saveRecordImage } from "@/lib/image-store";
import type { TaskUsage } from "@/lib/pricing";

const STORAGE_KEY = "openpix_history";
const HISTORY_STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

export type ReferenceThumb = {
  id: string;
  name: string;
  dataUrl: string;
};

export type RunningTask = {
  id: string;
  startedAt: number;
  model: string;
  modelName: string;
  sizeId: string;
  sizeLabel: string;
  customWidth?: number;
  customHeight?: number;
  prompt: string;
  referenceImageCount?: number;
  referenceThumbs?: ReferenceThumb[];
};

export type GenerationRecord = {
  id: string;
  startedAt: number;
  createdAt: number;
  durationMs: number;
  model: string;
  modelName: string;
  sizeId: string;
  sizeLabel: string;
  customWidth?: number;
  customHeight?: number;
  prompt: string;
  imageThumbUrl?: string;
  /** 远程图片 URL（非 base64） */
  imageUrl?: string;
  /** 原图已写入 IndexedDB，键为记录 id */
  imageStored?: boolean;
  /** @deprecated 仅用于旧数据迁移，不再写入 */
  transientImageUrl?: string;
  error?: string;
  referenceThumbs?: ReferenceThumb[];
  usage?: TaskUsage;
};

function normalizeRecord(raw: Partial<GenerationRecord>): GenerationRecord {
  const createdAt = raw.createdAt ?? Date.now();
  return {
    id: raw.id ?? crypto.randomUUID(),
    startedAt: raw.startedAt ?? createdAt,
    createdAt,
    durationMs: raw.durationMs ?? 0,
    model: raw.model ?? "",
    modelName: raw.modelName ?? "",
    sizeId: raw.sizeId ?? "",
    sizeLabel: raw.sizeLabel ?? "",
    customWidth: raw.customWidth,
    customHeight: raw.customHeight,
    prompt: raw.prompt ?? "",
    imageThumbUrl: raw.imageThumbUrl,
    imageUrl:
      raw.imageUrl && !raw.imageUrl.startsWith("data:image/")
        ? raw.imageUrl
        : undefined,
    imageStored: raw.imageStored,
    transientImageUrl: undefined,
    error: raw.error,
    referenceThumbs: raw.referenceThumbs,
    usage: raw.usage,
  };
}

function compareRecordsDesc(a: GenerationRecord, b: GenerationRecord): number {
  return b.startedAt - a.startedAt || b.createdAt - a.createdAt;
}

function estimateLocalStorageEntryBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

function sanitizeRecordForStorage(record: GenerationRecord): GenerationRecord {
  return {
    ...record,
    transientImageUrl: undefined,
  };
}

function encodeHistory(records: GenerationRecord[]): string {
  return JSON.stringify(records.map(sanitizeRecordForStorage));
}

function estimateHistoryStorageBytes(records: GenerationRecord[]): number {
  return estimateLocalStorageEntryBytes(STORAGE_KEY, encodeHistory(records));
}

function saveHistoryWithinBudget(
  records: GenerationRecord[],
  minimumRecordsToKeep = 0,
): GenerationRecord[] {
  const next = [...records].sort(compareRecordsDesc);

  const dropRecord = (record: GenerationRecord | undefined) => {
    if (record?.imageStored) {
      void deleteRecordImage(record.id);
    }
  };

  while (
    next.length > minimumRecordsToKeep &&
    estimateHistoryStorageBytes(next) > HISTORY_STORAGE_BUDGET_BYTES
  ) {
    dropRecord(next.pop());
  }

  while (next.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, encodeHistory(next));
      return next;
    } catch {
      if (next.length <= minimumRecordsToKeep) {
        throw new Error("History storage quota exceeded");
      }
      dropRecord(next.pop());
    }
  }

  localStorage.removeItem(STORAGE_KEY);
  return next;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remain = Math.round(seconds % 60);
    return `${minutes}分${remain}秒`;
  }
  return `${seconds.toFixed(1)}s`;
}

export function formatElapsed(startedAt: number, now = Date.now()): string {
  return formatDuration(now - startedAt);
}

function isDataImageUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

export async function loadHistory(): Promise<GenerationRecord[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<GenerationRecord>[];
    if (!Array.isArray(parsed)) return [];

    let migrated = false;
    const records = await Promise.all(
      parsed.map(async (item) => {
        const id = item.id ?? crypto.randomUUID();
        const legacyDataUrl = item.imageUrl;
        if (legacyDataUrl && isDataImageUrl(legacyDataUrl)) {
          await saveRecordImage(id, legacyDataUrl);
          migrated = true;
          return normalizeRecord({
            ...item,
            id,
            imageUrl: undefined,
            imageStored: true,
          });
        }
        return normalizeRecord({ ...item, id });
      }),
    );

    const sorted = records.sort(compareRecordsDesc);
    if (migrated) {
      saveHistoryWithinBudget(sorted);
    }
    return sorted;
  } catch {
    return [];
  }
}

export function saveHistory(records: GenerationRecord[]): void {
  saveHistoryWithinBudget(records);
}

export function deleteHistoryRecord(
  records: GenerationRecord[],
  id: string,
): GenerationRecord[] {
  const removed = records.find((r) => r.id === id);
  if (removed?.imageStored) {
    void deleteRecordImage(id);
  }
  const next = records.filter((r) => r.id !== id);
  saveHistory(next);
  return next;
}

export function appendHistoryRecords(
  records: GenerationRecord[],
  newRecords: GenerationRecord[],
): GenerationRecord[] {
  const next = [...newRecords, ...records].sort(compareRecordsDesc);
  return saveHistoryWithinBudget(next, Math.min(newRecords.length, 1));
}
