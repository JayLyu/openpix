"use client";

import { Database, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatOpenPixStorageOccupancy,
  type OpenPixStorageBreakdown,
} from "@/lib/storage-usage";
import { cn } from "@/lib/utils";

type RecordsToolbarProps = {
  recordCount: number;
  storageBreakdown: OpenPixStorageBreakdown;
  onClearCache: () => void;
  promptSearch: string;
  onPromptSearchChange: (value: string) => void;
};

function StorageBreakdownDetails({
  breakdown,
}: {
  breakdown: OpenPixStorageBreakdown;
}) {
  const totalLabel = formatOpenPixStorageOccupancy(breakdown.totalBytes);
  const localLabel = formatOpenPixStorageOccupancy(breakdown.localStorageBytes);
  const indexedDbLabel = formatOpenPixStorageOccupancy(breakdown.indexedDbBytes);

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">合计占用</dt>
        <dd className="font-medium tabular-nums">{totalLabel}</dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">本地缓存</dt>
        <dd className="font-medium tabular-nums">{localLabel}</dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">原图 IndexedDB</dt>
        <dd className="text-right font-medium tabular-nums">
          {indexedDbLabel}
          <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
            {breakdown.indexedDbImageCount} 张原图
          </span>
        </dd>
      </div>
    </dl>
  );
}

function DesktopStorageSummary({
  recordCount,
  breakdown,
  onClearCache,
}: {
  recordCount: number;
  breakdown: OpenPixStorageBreakdown;
  onClearCache: () => void;
}) {
  const totalLabel = formatOpenPixStorageOccupancy(breakdown.totalBytes);
  const localLabel = formatOpenPixStorageOccupancy(breakdown.localStorageBytes);
  const indexedDbLabel = formatOpenPixStorageOccupancy(breakdown.indexedDbBytes);

  return (
    <span className="hidden min-w-0 text-xs text-muted-foreground lg:inline">
      总 {recordCount} 条 · 合计 {totalLabel}
      <span className="text-muted-foreground/80">
        （本地缓存 {localLabel} · 原图 IndexedDB {indexedDbLabel}
        {breakdown.indexedDbImageCount > 0
          ? `，${breakdown.indexedDbImageCount} 张`
          : ""}
        ）
      </span>
      {" · "}
      <button
        type="button"
        onClick={onClearCache}
        className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
      >
        清理缓存
      </button>
    </span>
  );
}

export function RecordsToolbar({
  recordCount,
  storageBreakdown,
  onClearCache,
  promptSearch,
  onPromptSearchChange,
}: RecordsToolbarProps) {
  const indexedDbLabel = formatOpenPixStorageOccupancy(
    storageBreakdown.indexedDbBytes,
  );

  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-4">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        <h2 className="shrink-0 text-sm font-medium">生成记录</h2>

        <DesktopStorageSummary
          recordCount={recordCount}
          breakdown={storageBreakdown}
          onClearCache={onClearCache}
        />

        <Popover>
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 gap-1.5 px-2.5 lg:hidden",
            )}
            aria-label="查看记录与存储统计"
          >
            <Database className="size-4 shrink-0" aria-hidden />
            <span className="text-xs tabular-nums">
              {recordCount} 条 · 原图 {indexedDbLabel}
            </span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={8}
            className="w-[min(18rem,calc(100vw-2rem))] gap-3 p-4 lg:hidden"
          >
            <PopoverHeader>
              <PopoverTitle>记录与存储</PopoverTitle>
            </PopoverHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">生成记录</dt>
                <dd className="font-medium tabular-nums">{recordCount} 条</dd>
              </div>
            </dl>
            <StorageBreakdownDetails breakdown={storageBreakdown} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={onClearCache}
            >
              清理缓存
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative min-w-0 w-full lg:w-44 lg:shrink-0 xl:w-56">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={promptSearch}
          onChange={(event) => onPromptSearchChange(event.target.value)}
          placeholder="搜索提示词…"
          className="h-8 w-full pl-9 pr-8 text-sm"
          aria-label="搜索提示词"
        />
        {promptSearch && (
          <button
            type="button"
            onClick={() => onPromptSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
