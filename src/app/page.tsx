"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Loader2,
  Trash2,
  ImageOff,
  X,
  Download,
  ImagePlus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { CostSummary } from "@/components/cost-summary";
import { ImageLightbox } from "@/components/image-lightbox";
import { ApiKeyHeader } from "@/components/api-key-header";
import { RecordsToolbar } from "@/components/records-toolbar";
import { OpenRouterStatus } from "@/components/openrouter-status";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  GenerateImageButton,
  GenerationForm,
  type GenerationFormProps,
} from "@/components/generation-form";
import { toast } from "sonner";
import { MODELS } from "@/lib/models";
import {
  CUSTOM_SIZE_ID,
  DEFAULT_CUSTOM_HEIGHT,
  DEFAULT_CUSTOM_WIDTH,
  DEFAULT_SIZE_ID,
  formatSizeRecord,
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

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error("copy failed");
  }
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
      <span className="line-clamp-2 cursor-default text-sm leading-relaxed break-words">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void copyTextToClipboard(text)
              .then(() => {
                toast.success("已复制到剪贴板");
              })
              .catch(() => {
                toast.error("复制失败，请重试");
              });
          }}
          className="mr-1.5 inline text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        >
          复制
        </button>
        {content}
      </span>
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
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getRecordImageUrl = useCallback(
    (record: GenerationRecord) =>
      record.imageUrl && !isDataImageUrl(record.imageUrl)
        ? record.imageUrl
        : record.transientImageUrl,
    [],
  );

  const getRecordReferenceSource = useCallback((record: GenerationRecord) => {
    const imageUrl =
      record.imageUrl && !isDataImageUrl(record.imageUrl)
        ? record.imageUrl
        : record.transientImageUrl;
    if (imageUrl) return { imageUrl, isThumbnail: false };
    if (record.imageThumbUrl) {
      return { imageUrl: record.imageThumbUrl, isThumbnail: true };
    }
    return undefined;
  }, []);

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
      try {
        await downloadImage(imageUrl, record.createdAt);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "图片下载失败，请稍后重试");
      }
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
    const source = getRecordReferenceSource(record);
    if (!source) {
      setError("原图 URL 不存在，仅保留了缩略图");
      return;
    }
    await handleUseAsReference(source.imageUrl, `OpenPix-${record.createdAt}.jpg`);
    if (source.isThumbnail) {
      setError("原图 URL 不存在，已使用缩略图作为参考图");
    }
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
    setMobileFormOpen(true);
  };

  const generationFormProps: GenerationFormProps = {
    model,
    onModelChange: setModel,
    size,
    onSizeChange: setSize,
    sizeOpen,
    onSizeOpenToggle: () => setSizeOpen((open) => !open),
    selectedSize,
    customWidth,
    customHeight,
    customWidthInput,
    onCustomWidthInputChange: setCustomWidthInput,
    customHeightInput,
    onCustomHeightInputChange: setCustomHeightInput,
    onSaveCustomSize: saveCustomSize,
    customSizeError,
    systemPromptOpen,
    onSystemPromptOpenToggle: () => setSystemPromptOpen((open) => !open),
    systemPrompt,
    onSystemPromptChange: setSystemPrompt,
    onSaveSystemPrompt: saveSystemPrompt,
    referenceImages,
    onRemoveReferenceImage: removeReferenceImage,
    fileInputRef,
    onImageUpload: handleImageUpload,
    processingImage,
    onPreviewImage: setPreviewImage,
    prompt,
    onPromptChange: setPrompt,
  };

  const generateImageLabel =
    runningTasks.length > 0
      ? `生成图像（${runningTasks.length} 进行中）`
      : "生成图像";

  const handleGenerate = () => {
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
    setMobileFormOpen(false);

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
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <a
            href="https://github.com/JayLyu/openpix"
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-lg font-semibold tracking-tight transition-colors hover:text-foreground/80 sm:text-xl"
          >
            OpenPix
          </a>
          <ThemeToggle />
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
          <OpenRouterStatus hideLabelOnMobile />
          <ApiKeyHeader
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onKeySavedChange={setKeySaved}
            onBlurSave={saveKey}
            keySaved={keySaved}
            onClear={clearApiKey}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden min-h-0 w-[420px] shrink-0 flex-col border-r border-border lg:flex">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <GenerationForm {...generationFormProps} />
          </div>
          <div className="shrink-0 border-t border-border bg-background p-4 px-6">
            <GenerateImageButton
              runningCount={runningTasks.length}
              canGenerate={canGenerate}
              onClick={handleGenerate}
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          <RecordsToolbar
            recordCount={listItems.length}
            storageOccupancyLabel={storageOccupancyLabel}
            onClearCache={openClearCacheDialog}
            promptSearch={promptSearch}
            onPromptSearchChange={setPromptSearch}
          />

          <div className="scrollbar-stable min-h-0 flex-1 overflow-y-scroll px-6 py-4">
          {listItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
              <span className="lg:hidden">
                暂无生成记录，点击底部「开始创作」填写表单
              </span>
              <span className="hidden lg:inline">
                暂无生成记录，填写左侧表单开始创作
              </span>
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

      {!mobileFormOpen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="px-4 py-3">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setMobileFormOpen(true)}
            >
              开始创作
            </Button>
          </div>
        </nav>
      )}

      {mobileFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-form-dialog-title"
        >
          <div
            className="flex h-[95vh] w-[90vw] min-h-0 flex-col rounded-lg border border-border bg-popover shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2
                id="mobile-form-dialog-title"
                className="text-sm font-medium"
              >
                创作
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileFormOpen(false)}
                aria-label="关闭"
              >
                <X />
              </Button>
            </div>
            <div className="scrollbar-stable min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <GenerationForm {...generationFormProps} idPrefix="mobile-" />
            </div>
            <div className="shrink-0 border-t border-border p-4">
              <GenerateImageButton
                runningCount={runningTasks.length}
                canGenerate={canGenerate}
                onClick={handleGenerate}
              />
              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}

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
              将把该失败任务的模型、尺寸和提示词回填到创作表单，当前表单内容将被覆盖。是否继续？
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
