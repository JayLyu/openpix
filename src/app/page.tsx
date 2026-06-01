"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Loader2,
  Trash2,
  ImageOff,
  X,
  Upload,
  ChevronDown,
  CircleHelp,
  Download,
  ImagePlus,
  RotateCcw,
  CircleCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { CostSummary } from "@/components/cost-summary";
import { ImageLightbox } from "@/components/image-lightbox";
import { OpenRouterStatus } from "@/components/openrouter-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { MODELS } from "@/lib/models";
import {
  CUSTOM_SIZE_ID,
  DEFAULT_CUSTOM_HEIGHT,
  DEFAULT_CUSTOM_WIDTH,
  DEFAULT_SIZE_ID,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  SIZE_CARD_OPTIONS,
  formatSizePixels,
  formatSizeRecord,
  formatSizeSummary,
  parseCustomDimension,
  resolveSizeOption,
  validateCustomDimensions,
} from "@/lib/sizes";
import {
  type GenerationRecord,
  type ReferenceThumb,
  type RunningTask,
  appendHistoryRecords,
  deleteHistoryRecord,
  formatDuration,
  formatElapsed,
  loadHistory,
} from "@/lib/history";
import { splitUsageCost } from "@/lib/pricing";
import {
  DEFAULT_USD_CNY_RATE,
  getUsdToCnyRate,
  type UsdCnyRateSource,
} from "@/lib/exchange-rate";
import { generateImage, validateOpenRouterApiKey } from "@/lib/openrouter";
import {
  type ProcessedImage,
  MAX_REFERENCE_IMAGES,
  createImageThumbnail,
  createReferenceThumbnails,
  processReferenceImage,
  processReferenceImageFromUrl,
} from "@/lib/image";
import { downloadImage } from "@/lib/download-image";
import {
  clearOpenPixCache,
  formatOpenPixStorageOccupancy,
  getOpenPixStorageBytes,
} from "@/lib/storage-usage";
import { cn } from "@/lib/utils";

type ListItem =
  | ({ kind: "running" } & RunningTask)
  | ({ kind: "done" } & GenerationRecord);

type PreviewImage = {
  src: string;
  alt: string;
};

const CLEAR_CACHE_CONFIRM_PHRASE = "确认清理";

function getRecordImageThumb(record: GenerationRecord): string | undefined {
  return record.imageThumbUrl ?? record.imageUrl ?? record.transientImageUrl;
}

function isDataImageUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

async function createOptionalImageThumbnail(
  imageUrl: string,
): Promise<string | undefined> {
  try {
    return await createImageThumbnail(imageUrl);
  } catch {
    return undefined;
  }
}

function ReferenceThumbRow({ thumbs }: { thumbs: ReferenceThumb[] }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="text-[10px] text-muted-foreground shrink-0">参考图</span>
      <div className="flex items-center gap-1">
        {thumbs.map((thumb) => (
          <Tooltip key={thumb.id} content={thumb.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb.dataUrl}
              alt={thumb.name}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onContextMenu={(event) => event.preventDefault()}
              className="size-10 rounded border border-border object-contain bg-muted select-none [-webkit-user-drag:none]"
            />
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function highlightPromptText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: React.ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  let key = 0;

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }
    parts.push(
      <mark
        key={key++}
        className="rounded-sm bg-primary/20 px-0.5 text-foreground"
      >
        {text.slice(matchIndex, matchIndex + lowerQuery.length)}
      </mark>,
    );
    startIndex = matchIndex + lowerQuery.length;
    matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }

  return parts.length > 0 ? parts : text;
}

function RecordPrompt({
  text,
  highlightQuery = "",
}: {
  text: string;
  highlightQuery?: string;
}) {
  const content = highlightPromptText(text, highlightQuery);

  return (
    <Tooltip
      content={content}
      contentMaxWidth={480}
      className="block min-w-0 w-full"
      contentClassName="whitespace-normal break-words text-left text-sm leading-relaxed px-3 py-2.5"
    >
      <p className="line-clamp-2 cursor-default text-sm leading-relaxed break-words">
        {content}
      </p>
    </Tooltip>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [size, setSize] = useState<string>(DEFAULT_SIZE_ID);
  const [customWidthInput, setCustomWidthInput] = useState(
    String(DEFAULT_CUSTOM_WIDTH),
  );
  const [customHeightInput, setCustomHeightInput] = useState(
    String(DEFAULT_CUSTOM_HEIGHT),
  );
  const [sizeOpen, setSizeOpen] = useState(true);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [runningTasks, setRunningTasks] = useState<RunningTask[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [referenceImages, setReferenceImages] = useState<ProcessedImage[]>([]);
  const [processingImage, setProcessingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [retryRecord, setRetryRecord] = useState<GenerationRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<GenerationRecord | null>(null);
  const [clearCacheConfirmOpen, setClearCacheConfirmOpen] = useState(false);
  const [clearCacheConfirmText, setClearCacheConfirmText] = useState("");
  const [usdCnyRate, setUsdCnyRate] = useState(DEFAULT_USD_CNY_RATE);
  const [usdCnyRateSource, setUsdCnyRateSource] =
    useState<UsdCnyRateSource>("default");
  const [promptSearch, setPromptSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getRecordImageUrl = useCallback(
    (record: GenerationRecord) =>
      record.imageUrl && !isDataImageUrl(record.imageUrl)
        ? record.imageUrl
        : record.transientImageUrl,
    [],
  );

  const migrateLegacyHistoryImages = useCallback(
    async (records: GenerationRecord[]) => {
      const legacyRecords = records.filter(
        (record) => record.imageUrl && isDataImageUrl(record.imageUrl),
      );
      if (legacyRecords.length === 0) return;

      try {
        const migrated = await Promise.all(
          records.map(async (record) => {
            if (!record.imageUrl || !isDataImageUrl(record.imageUrl)) {
              return record;
            }
            const imageThumbUrl =
              record.imageThumbUrl ??
              (await createImageThumbnail(record.imageUrl));
            return {
              ...record,
              imageThumbUrl,
              imageUrl: undefined,
            };
          }),
        );

        setHistory(() => appendHistoryRecords([], migrated));
      } catch {
        setError("旧历史图片迁移失败，请先清理缓存后再生成");
      }
    },
    [],
  );

  const openRecordPreview = useCallback(
    async (record: GenerationRecord) => {
      const imageUrl = getRecordImageUrl(record);
      if (!imageUrl) {
        setError("原图 URL 不存在，仅保留了缩略图");
        return;
      }
      setPreviewImage({
        src: imageUrl,
        alt: record.prompt,
      });
    },
    [getRecordImageUrl],
  );

  const downloadRecordImage = useCallback(
    async (record: GenerationRecord) => {
      const imageUrl = getRecordImageUrl(record);
      if (!imageUrl) {
        setError("原图 URL 不存在，仅保留了缩略图");
        return;
      }
      downloadImage(imageUrl, record.createdAt);
    },
    [getRecordImageUrl],
  );

  useEffect(() => {
    const savedKey = localStorage.getItem("openpix_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setKeySaved(true);
    }
    const savedSystem = localStorage.getItem("openpix_system_prompt");
    if (savedSystem) setSystemPrompt(savedSystem);
    const savedCustomSize = localStorage.getItem("openpix_custom_size");
    if (savedCustomSize) {
      try {
        const parsed = JSON.parse(savedCustomSize) as {
          width?: number;
          height?: number;
        };
        if (parsed.width) setCustomWidthInput(String(parsed.width));
        if (parsed.height) setCustomHeightInput(String(parsed.height));
      } catch {
        // ignore invalid cache
      }
    }
    const loadedHistory = loadHistory();
    setHistory(loadedHistory);
    void migrateLegacyHistoryImages(loadedHistory);
  }, [migrateLegacyHistoryImages]);

  useEffect(() => {
    void getUsdToCnyRate().then(({ rate, source }) => {
      setUsdCnyRate(rate);
      setUsdCnyRateSource(source);
    });
  }, []);

  useEffect(() => {
    if (runningTasks.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [runningTasks.length]);

  const saveKey = useCallback(() => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem("openpix_api_key", trimmed);
      setKeySaved(true);
    } else {
      localStorage.removeItem("openpix_api_key");
      setKeySaved(false);
    }
  }, [apiKey]);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem("openpix_api_key");
    setApiKey("");
    setKeySaved(false);
  }, []);

  const saveSystemPrompt = useCallback(() => {
    const trimmed = systemPrompt.trim();
    if (trimmed) {
      localStorage.setItem("openpix_system_prompt", trimmed);
    } else {
      localStorage.removeItem("openpix_system_prompt");
    }
  }, [systemPrompt]);

  const saveCustomSize = useCallback(() => {
    const width = parseCustomDimension(customWidthInput);
    const height = parseCustomDimension(customHeightInput);
    if (width == null || height == null) return;
    localStorage.setItem(
      "openpix_custom_size",
      JSON.stringify({ width, height }),
    );
  }, [customWidthInput, customHeightInput]);

  const customWidth = parseCustomDimension(customWidthInput);
  const customHeight = parseCustomDimension(customHeightInput);

  const selectedSize = useMemo(
    () =>
      resolveSizeOption(
        size,
        customWidth ?? undefined,
        customHeight ?? undefined,
      ),
    [size, customWidth, customHeight],
  );

  const customSizeError = useMemo(() => {
    if (size !== CUSTOM_SIZE_ID) return null;
    if (customWidth == null || customHeight == null) {
      return "请输入有效的宽度和高度";
    }
    return validateCustomDimensions(customWidth, customHeight);
  }, [size, customWidth, customHeight]);

  const selectedModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  const listItems = useMemo<ListItem[]>(() => {
    const running: ListItem[] = runningTasks.map((task) => ({
      kind: "running",
      ...task,
    }));
    const done: ListItem[] = history.map((record) => ({
      kind: "done",
      ...record,
    }));
    return [...running, ...done].sort((a, b) => b.startedAt - a.startedAt);
  }, [runningTasks, history]);

  const filteredListItems = useMemo(() => {
    const query = promptSearch.trim().toLowerCase();
    if (!query) return listItems;
    return listItems.filter((item) =>
      item.prompt.toLowerCase().includes(query),
    );
  }, [listItems, promptSearch]);

  const [storageOccupancyLabel, setStorageOccupancyLabel] = useState("0 KB");

  useEffect(() => {
    setStorageOccupancyLabel(
      formatOpenPixStorageOccupancy(getOpenPixStorageBytes()),
    );
  }, [history]);

  const canGenerate = Boolean(apiKey.trim()) && !customSizeError;

  const canConfirmClearCache =
    clearCacheConfirmText.trim() === CLEAR_CACHE_CONFIRM_PHRASE;

  const openClearCacheDialog = () => {
    setClearCacheConfirmText("");
    setClearCacheConfirmOpen(true);
  };

  const closeClearCacheDialog = () => {
    setClearCacheConfirmOpen(false);
    setClearCacheConfirmText("");
  };

  const handleClearCache = () => {
    if (!canConfirmClearCache) return;
    clearOpenPixCache();
    setHistory([]);
    setApiKey("");
    setKeySaved(false);
    setSystemPrompt("");
    closeClearCacheDialog();
  };

  const handleDelete = (record: GenerationRecord) => {
    setHistory((prev) => deleteHistoryRecord(prev, record.id));
  };

  const requestDelete = (record: GenerationRecord) => {
    setDeleteRecord(record);
  };

  const confirmDelete = () => {
    if (!deleteRecord) return;
    handleDelete(deleteRecord);
    setDeleteRecord(null);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
    if (remaining <= 0) {
      setError(`最多上传 ${MAX_REFERENCE_IMAGES} 张参考图`);
      return;
    }

    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      setError(`最多 ${MAX_REFERENCE_IMAGES} 张，已添加前 ${remaining} 张`);
    } else {
      setError("");
    }

    setProcessingImage(true);
    try {
      const processed = await Promise.all(
        toProcess.map((file) => processReferenceImage(file)),
      );
      setReferenceImages((prev) =>
        [...prev, ...processed].slice(0, MAX_REFERENCE_IMAGES),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "图片处理失败");
    } finally {
      setProcessingImage(false);
    }
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages((prev) => prev.filter((image) => image.id !== id));
  };

  const handleUseAsReference = async (imageUrl: string, name: string) => {
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
      setError(`参考图已满，最多 ${MAX_REFERENCE_IMAGES} 张`);
      return;
    }

    if (referenceImages.some((image) => image.dataUrl === imageUrl)) {
      setError("该图片已在参考图中");
      return;
    }

    setProcessingImage(true);
    setError("");
    try {
      const processed = await processReferenceImageFromUrl(imageUrl, name);
      setReferenceImages((prev) =>
        [...prev, processed].slice(0, MAX_REFERENCE_IMAGES),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "添加参考图失败");
    } finally {
      setProcessingImage(false);
    }
  };

  const handleUseRecordAsReference = async (record: GenerationRecord) => {
    const imageUrl = getRecordImageUrl(record);
    if (!imageUrl) {
      setError("原图 URL 不存在，仅保留了缩略图");
      return;
    }
    await handleUseAsReference(imageUrl, `OpenPix-${record.createdAt}.jpg`);
  };

  const requestRetry = (record: GenerationRecord) => {
    setRetryRecord(record);
  };

  const applyRetry = () => {
    if (!retryRecord) return;
    setModel(retryRecord.model);
    setSize(retryRecord.sizeId);
    if (
      retryRecord.sizeId === CUSTOM_SIZE_ID &&
      retryRecord.customWidth &&
      retryRecord.customHeight
    ) {
      setCustomWidthInput(String(retryRecord.customWidth));
      setCustomHeightInput(String(retryRecord.customHeight));
    }
    setPrompt(retryRecord.prompt);
    setError("");
    setRetryRecord(null);
  };

  const generate = () => {
    const keyError = validateOpenRouterApiKey(apiKey);
    if (keyError) {
      setError(keyError);
      return;
    }
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }
    if (customSizeError) {
      setError(customSizeError);
      return;
    }

    setError("");

    const taskId = crypto.randomUUID();
    const startedAt = Date.now();
    const taskModel = model;
    const taskSize = size;
    const taskCustomWidth =
      taskSize === CUSTOM_SIZE_ID ? customWidth ?? undefined : undefined;
    const taskCustomHeight =
      taskSize === CUSTOM_SIZE_ID ? customHeight ?? undefined : undefined;
    const taskPrompt = prompt.trim();
    const taskSystemPrompt = systemPrompt.trim() || undefined;
    const taskAspectRatio = selectedSize.aspectRatio;
    const taskModelName = selectedModel.name;
    const taskSizeLabel = formatSizeRecord(selectedSize);
    const taskReferenceImages = referenceImages.map((image) => image.dataUrl);
    const taskReferenceSources = referenceImages.map((image) => ({
      id: image.id,
      name: image.name,
      dataUrl: image.dataUrl,
    }));

    void (async () => {
      let taskReferenceThumbs: ReferenceThumb[] | undefined;
      if (taskReferenceSources.length > 0) {
        try {
          taskReferenceThumbs = await createReferenceThumbnails(
            taskReferenceSources,
          );
        } catch {
          taskReferenceThumbs = undefined;
        }
      }

      const task: RunningTask = {
        id: taskId,
        startedAt,
        model: taskModel,
        modelName: taskModelName,
        sizeId: taskSize,
        sizeLabel: taskSizeLabel,
        customWidth: taskCustomWidth,
        customHeight: taskCustomHeight,
        prompt: taskPrompt,
        referenceImageCount: taskReferenceThumbs?.length,
        referenceThumbs: taskReferenceThumbs,
      };

      setRunningTasks((prev) => [task, ...prev]);

      try {
        const data = await generateImage({
          apiKey: apiKey.trim(),
          model: taskModel,
          prompt: taskPrompt,
          systemPrompt: taskSystemPrompt,
          aspectRatio: taskAspectRatio,
          referenceImages:
            taskReferenceImages.length > 0 ? taskReferenceImages : undefined,
        });

        const completedAt = Date.now();
        const durationMs = completedAt - startedAt;
        const perImageUsage = data.usage
          ? splitUsageCost(data.usage, data.images.length)
          : undefined;
        const newRecords: GenerationRecord[] = await Promise.all(
          data.images.map(async (imageUrl, index) => ({
            id: crypto.randomUUID(),
            startedAt,
            createdAt: completedAt - index,
            durationMs,
            model: taskModel,
            modelName: taskModelName,
            sizeId: taskSize,
            sizeLabel: taskSizeLabel,
            customWidth: taskCustomWidth,
            customHeight: taskCustomHeight,
            prompt: taskPrompt,
            imageUrl: isDataImageUrl(imageUrl) ? undefined : imageUrl,
            transientImageUrl: isDataImageUrl(imageUrl) ? imageUrl : undefined,
            imageThumbUrl: await createOptionalImageThumbnail(imageUrl),
            referenceThumbs: taskReferenceThumbs,
            usage: perImageUsage,
          })),
        );

        setRunningTasks((prev) => prev.filter((t) => t.id !== taskId));
        setHistory((prev) => {
          try {
            return appendHistoryRecords(prev, newRecords);
          } catch {
            setError("历史记录保存失败，可能是浏览器存储空间不足");
            return prev;
          }
        });
      } catch (err: unknown) {
        const completedAt = Date.now();
        const durationMs = completedAt - startedAt;
        const message = err instanceof Error ? err.message : "生成失败，请重试";
        const failedRecord: GenerationRecord = {
          id: taskId,
          startedAt,
          createdAt: completedAt,
          durationMs,
          model: taskModel,
          modelName: taskModelName,
          sizeId: taskSize,
          sizeLabel: taskSizeLabel,
          customWidth: taskCustomWidth,
          customHeight: taskCustomHeight,
          prompt: taskPrompt,
          error: message,
          referenceThumbs: taskReferenceThumbs,
        };

        setRunningTasks((prev) => prev.filter((t) => t.id !== taskId));
        setHistory((prev) => appendHistoryRecords(prev, [failedRecord]));
      }
    })();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="https://github.com/JayLyu/openpix"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xl font-semibold tracking-tight transition-colors hover:text-foreground/80"
          >
            OpenPix
          </a>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 min-w-0 justify-end">
          <OpenRouterStatus />
          <div className="inline-flex items-baseline gap-1 shrink-0 text-sm text-muted-foreground">
            <span>API KEY</span>
            <div className="relative group leading-none">
              <button
                type="button"
                className="inline-flex translate-y-[0.5px] rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="API KEY 说明"
              >
                <CircleHelp className="size-3.5" />
              </button>
              <div
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              >
                <p className="font-medium text-foreground">
                  密钥仅保存在本机浏览器缓存（localStorage），不会上传到
                  OpenPix 或任何服务器。
                </p>
                <p className="mt-2 text-muted-foreground">
                  请使用 OpenRouter 密钥（sk-or-…），在{" "}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    openrouter.ai/keys
                  </a>{" "}
                  创建，不支持 OpenAI 官方密钥。
                </p>
                {(keySaved || apiKey.trim()) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 w-full text-xs"
                    onClick={clearApiKey}
                  >
                    清除本地缓存
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="relative">
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeySaved(false);
              }}
              onBlur={saveKey}
              className="font-mono text-sm w-44 sm:w-56 pr-8"
            />
            {keySaved && apiKey.trim() && (
              <CircleCheck
                className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-emerald-500"
                aria-label="已写入浏览器本地缓存"
              />
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex min-h-0 w-full flex-1 flex-col border-b border-border lg:w-[420px] lg:flex-none lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs tracking-wider text-muted-foreground">
                模型
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {MODELS.map((m) => {
                  const selected = model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-left transition-colors min-w-0",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                          : "border-border hover:border-foreground/20 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-snug truncate">
                            {m.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {m.provider}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0 rounded-full border-2 transition-colors",
                            selected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40",
                          )}
                          aria-hidden
                        >
                          {selected && (
                            <span className="flex size-full items-center justify-center">
                              <span className="size-1 rounded-full bg-primary-foreground" />
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSizeOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>尺寸</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  {!sizeOpen && (
                    <span className="truncate text-[10px] font-normal normal-case tracking-normal text-muted-foreground/90">
                      {formatSizeSummary(selectedSize)}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      sizeOpen && "rotate-180",
                    )}
                  />
                </span>
              </button>
              {sizeOpen && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {SIZE_CARD_OPTIONS.map((s) => {
                      const selected = size === s.id;
                      const isCustom = s.id === CUSTOM_SIZE_ID;
                      const displaySize = isCustom
                        ? resolveSizeOption(
                            CUSTOM_SIZE_ID,
                            customWidth ?? undefined,
                            customHeight ?? undefined,
                          )
                        : s;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSize(s.id)}
                          className={cn(
                            "rounded-lg border p-2.5 text-left transition-colors min-w-0",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                              : "border-border hover:border-foreground/20 hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-snug truncate">
                                {s.label}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                                {isCustom
                                  ? formatSizePixels(displaySize)
                                  : `${s.aspectRatio} · ${formatSizePixels(s)}`}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground/80 truncate">
                                {s.platform}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "mt-0.5 size-3.5 shrink-0 rounded-full border-2 transition-colors",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/40",
                              )}
                              aria-hidden
                            >
                              {selected && (
                                <span className="flex size-full items-center justify-center">
                                  <span className="size-1 rounded-full bg-primary-foreground" />
                                </span>
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {size === CUSTOM_SIZE_ID && (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="customWidth"
                            className="text-[10px] text-muted-foreground"
                          >
                            宽度（px）
                          </Label>
                          <Input
                            id="customWidth"
                            type="number"
                            inputMode="numeric"
                            min={MIN_IMAGE_DIMENSION}
                            max={MAX_IMAGE_DIMENSION}
                            step={1}
                            value={customWidthInput}
                            onChange={(event) =>
                              setCustomWidthInput(event.target.value)
                            }
                            onBlur={saveCustomSize}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="customHeight"
                            className="text-[10px] text-muted-foreground"
                          >
                            高度（px）
                          </Label>
                          <Input
                            id="customHeight"
                            type="number"
                            inputMode="numeric"
                            min={MIN_IMAGE_DIMENSION}
                            max={MAX_IMAGE_DIMENSION}
                            step={1}
                            value={customHeightInput}
                            onChange={(event) =>
                              setCustomHeightInput(event.target.value)
                            }
                            onBlur={saveCustomSize}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80">
                        宽高范围 {MIN_IMAGE_DIMENSION}–{MAX_IMAGE_DIMENSION}{" "}
                        像素，需为整数
                      </p>
                      {customSizeError && (
                        <p className="text-[10px] text-destructive">
                          {customSizeError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSystemPromptOpen((open) => !open)}
                className="flex w-full items-center justify-between text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>
                  系统提示词
                  <span className="ml-1 text-muted-foreground/70">
                    （可选）
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    systemPromptOpen && "rotate-180",
                  )}
                />
              </button>
              {systemPromptOpen && (
                <>
                  <Textarea
                    id="systemPrompt"
                    placeholder="设定全局风格，例如：扁平插画风格、品牌主色为蓝色、图片中的文字使用中文…"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    onBlur={saveSystemPrompt}
                    className="min-h-[72px] resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground/70">
                    用于统一画风、品牌调性或输出规范，留空则仅使用下方提示词。
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs tracking-wider text-muted-foreground">
                  参考图
                  <span className="ml-1 text-muted-foreground/70">
                    （可选，最多 {MAX_REFERENCE_IMAGES} 张）
                  </span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              {referenceImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {referenceImages.map((image) => (
                    <div
                      key={image.id}
                      className="relative rounded-lg border border-border overflow-hidden"
                    >
                      <button
                        type="button"
                        className="block w-full aspect-square cursor-zoom-in bg-muted"
                        onClick={() =>
                          setPreviewImage({
                            src: image.dataUrl,
                            alt: image.name,
                          })
                        }
                        aria-label={`预览 ${image.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.dataUrl}
                          alt={image.name}
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div className="px-2 py-1.5 text-[10px] leading-tight text-muted-foreground border-t border-border">
                        <p className="truncate">{image.name}</p>
                        <p>
                          {image.width}×{image.height}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1 right-1 bg-background/80 hover:bg-background"
                        onClick={() => removeReferenceImage(image.id)}
                        aria-label={`移除 ${image.name}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {referenceImages.length < MAX_REFERENCE_IMAGES && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={processingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {processingImage ? (
                    <>
                      <Loader2 className="animate-spin" />
                      处理中…
                    </>
                  ) : (
                    <>
                      <Upload />
                      {referenceImages.length > 0
                        ? "继续添加参考图"
                        : "上传参考图"}
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-muted-foreground/70">
                支持 JPG / PNG / WebP / GIF，大图会自动压缩至 2048px
                长边以内再发送。
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="prompt"
                className="text-xs tracking-wider text-muted-foreground"
              >
                提示词
              </Label>
              <Textarea
                id="prompt"
                placeholder="描述你想生成的图像…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[180px] resize-none text-sm"
              />
            </div>

            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-background p-4 px-6">
            <Button
              onClick={generate}
              className="w-full"
              size="lg"
              disabled={!canGenerate}
            >
              {runningTasks.length > 0
                ? `生成图像（${runningTasks.length} 进行中）`
                : "生成图像"}
            </Button>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <h2 className="shrink-0 text-sm font-medium">生成记录</h2>
              <span className="shrink-0 text-xs text-muted-foreground">
                总 {listItems.length} 条数据 · 占 {storageOccupancyLabel} ·{" "}
                <button
                  type="button"
                  onClick={openClearCacheDialog}
                  className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                >
                  清理缓存
                </button>
              </span>
            </div>
            <div className="relative w-44 shrink-0 sm:w-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={promptSearch}
                onChange={(event) => setPromptSearch(event.target.value)}
                placeholder="搜索提示词…"
                className="h-8 pl-9 pr-8 text-sm"
                aria-label="搜索提示词"
              />
              {promptSearch && (
                <button
                  type="button"
                  onClick={() => setPromptSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label="清除搜索"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="scrollbar-stable min-h-0 flex-1 overflow-y-scroll px-6 py-4">
          {listItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              暂无生成记录，填写左侧表单开始创作
            </div>
          ) : filteredListItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              未找到包含「{promptSearch.trim()}」的提示词
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListItems.map((item) => {
                if (item.kind === "running") {
                  return (
                    <article
                      key={item.id}
                      className="flex gap-4 rounded-lg border border-primary/30 bg-primary/5 p-3"
                    >
                      <div className="shrink-0 w-28 h-28 rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {item.modelName}
                          </span>
                          <span>·</span>
                          <span>{item.sizeLabel}</span>
                          <span>·</span>
                          <span className="text-primary">
                            进行中 {formatElapsed(item.startedAt, now)}
                          </span>
                        </div>
                        <RecordPrompt
                          text={item.prompt}
                          highlightQuery={promptSearch}
                        />
                        {item.referenceThumbs &&
                          item.referenceThumbs.length > 0 && (
                            <ReferenceThumbRow thumbs={item.referenceThumbs} />
                          )}
                      </div>
                    </article>
                  );
                }

                const failed = Boolean(item.error);
                const displayImageUrl = getRecordImageThumb(item);
                return (
                  <article
                    key={item.id}
                    className="flex gap-4 rounded-lg border border-border p-3"
                  >
                    <div className="relative shrink-0 w-28 h-28 rounded-md overflow-hidden border border-border bg-muted">
                      {displayImageUrl ? (
                        <>
                          <button
                            type="button"
                            className="w-full h-full cursor-zoom-in"
                            onClick={() => void openRecordPreview(item)}
                            aria-label="查看大图"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displayImageUrl}
                              alt={item.prompt}
                              className="w-full h-full object-contain bg-muted"
                            />
                          </button>
                          <div className="absolute bottom-1 right-1 flex items-center gap-1">
                            <Tooltip
                              content="设为参考图"
                              contentClassName="whitespace-nowrap"
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="bg-background/80 hover:bg-background"
                                disabled={processingImage}
                                onClick={() =>
                                  void handleUseRecordAsReference(item)
                                }
                                aria-label="设为参考图"
                              >
                                <ImagePlus />
                              </Button>
                            </Tooltip>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="bg-background/80 hover:bg-background"
                              onClick={() => void downloadRecordImage(item)}
                              aria-label="下载图片"
                            >
                              <Download />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {item.modelName}
                        </span>
                        <span>·</span>
                        <span>{item.sizeLabel}</span>
                        <span>·</span>
                        <span>
                          耗时 {formatDuration(item.durationMs)}
                          {failed ? " · 失败" : ""}
                        </span>
                        {item.usage && (
                          <>
                            <span>·</span>
                            <CostSummary
                              usage={item.usage}
                              usdCnyRate={usdCnyRate}
                              rateSource={usdCnyRateSource}
                            />
                          </>
                        )}
                        <span>·</span>
                        <time
                          dateTime={new Date(item.createdAt).toISOString()}
                        >
                          {new Date(item.createdAt).toLocaleString("zh-CN")}
                        </time>
                      </div>
                      <RecordPrompt
                        text={item.prompt}
                        highlightQuery={promptSearch}
                      />
                      {item.referenceThumbs &&
                        item.referenceThumbs.length > 0 && (
                          <ReferenceThumbRow thumbs={item.referenceThumbs} />
                        )}
                      {failed && (
                        <p className="text-sm text-destructive">{item.error}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      {failed && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => requestRetry(item)}
                          aria-label="重新生成"
                        >
                          <RotateCcw />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => requestDelete(item)}
                        aria-label="删除记录"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </main>
      </div>

      {clearCacheConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeClearCacheDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-cache-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-popover p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="clear-cache-dialog-title" className="text-sm font-medium">
              确认清理缓存
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              将清除本机保存的生成记录、API KEY 和系统提示词等数据（主题设置会保留），此操作不可恢复。
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              请在下方输入「{CLEAR_CACHE_CONFIRM_PHRASE}」以继续。
            </p>
            <Input
              value={clearCacheConfirmText}
              onChange={(event) => setClearCacheConfirmText(event.target.value)}
              placeholder={CLEAR_CACHE_CONFIRM_PHRASE}
              className="mt-4"
              aria-label={`输入 ${CLEAR_CACHE_CONFIRM_PHRASE} 以确认清理`}
              autoComplete="off"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeClearCacheDialog}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canConfirmClearCache}
                onClick={handleClearCache}
              >
                确认清理
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteRecord(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-record-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-popover p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-record-dialog-title" className="text-sm font-medium">
              确认删除记录
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              删除后无法恢复，本机保存的该条生成记录和图片将被清除。是否继续？
            </p>
            <p className="mt-3 line-clamp-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground/90">
              {deleteRecord.prompt}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteRecord(null)}
              >
                取消
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete}>
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {retryRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRetryRecord(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="retry-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-popover p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="retry-dialog-title" className="text-sm font-medium">
              确认回填表单
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              将把该失败任务的模型、尺寸和提示词回填到左侧表单，当前表单内容将被覆盖。是否继续？
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRetryRecord(null)}
              >
                取消
              </Button>
              <Button type="button" onClick={applyRetry}>
                确认回填
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
