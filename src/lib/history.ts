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
  imageUrl?: string;
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
    imageUrl: raw.imageUrl,
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

  while (
    next.length > minimumRecordsToKeep &&
    estimateHistoryStorageBytes(next) > HISTORY_STORAGE_BUDGET_BYTES
  ) {
    next.pop();
  }

  while (next.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, encodeHistory(next));
      return next;
    } catch {
      if (next.length <= minimumRecordsToKeep) {
        throw new Error("History storage quota exceeded");
      }
      next.pop();
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

export function loadHistory(): GenerationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<GenerationRecord>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).sort(compareRecordsDesc);
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
