import type { TaskUsage } from "@/lib/pricing";

const STORAGE_KEY = "openpix_history";

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
  imageUrl?: string;
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
    imageUrl: raw.imageUrl,
    error: raw.error,
    referenceThumbs: raw.referenceThumbs,
    usage: raw.usage,
  };
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
    return parsed
      .map(normalizeRecord)
      .sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export function saveHistory(records: GenerationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
  const next = [...newRecords, ...records].sort(
    (a, b) => b.startedAt - a.startedAt,
  );
  saveHistory(next);
  return next;
}
