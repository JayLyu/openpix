"use client";

import type { ChangeEventHandler, RefObject } from "react";
import { ChevronDown, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MODELS } from "@/lib/models";
import {
  CUSTOM_SIZE_ID,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  SIZE_CARD_OPTIONS,
  formatSizePixels,
  formatSizeSummary,
  resolveSizeOption,
  type SizeOption,
} from "@/lib/sizes";
import { type ProcessedImage, MAX_REFERENCE_IMAGES } from "@/lib/image";
import { cn } from "@/lib/utils";

type PreviewImage = {
  src: string;
  alt: string;
};

export type GenerationFormProps = {
  idPrefix?: string;
  model: string;
  onModelChange: (modelId: string) => void;
  size: string;
  onSizeChange: (sizeId: string) => void;
  sizeOpen: boolean;
  onSizeOpenToggle: () => void;
  selectedSize: SizeOption;
  customWidth: number | null;
  customHeight: number | null;
  customWidthInput: string;
  onCustomWidthInputChange: (value: string) => void;
  customHeightInput: string;
  onCustomHeightInputChange: (value: string) => void;
  onSaveCustomSize: () => void;
  customSizeError: string | null;
  systemPromptOpen: boolean;
  onSystemPromptOpenToggle: () => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onSaveSystemPrompt: () => void;
  referenceImages: ProcessedImage[];
  onRemoveReferenceImage: (id: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageUpload: ChangeEventHandler<HTMLInputElement>;
  processingImage: boolean;
  onPreviewImage: (image: PreviewImage) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
};

export function GenerationForm({
  idPrefix = "",
  model,
  onModelChange,
  size,
  onSizeChange,
  sizeOpen,
  onSizeOpenToggle,
  selectedSize,
  customWidth,
  customHeight,
  customWidthInput,
  onCustomWidthInputChange,
  customHeightInput,
  onCustomHeightInputChange,
  onSaveCustomSize,
  customSizeError,
  systemPromptOpen,
  onSystemPromptOpenToggle,
  systemPrompt,
  onSystemPromptChange,
  onSaveSystemPrompt,
  referenceImages,
  onRemoveReferenceImage,
  fileInputRef,
  onImageUpload,
  processingImage,
  onPreviewImage,
  prompt,
  onPromptChange,
}: GenerationFormProps) {
  const customWidthId = `${idPrefix}customWidth`;
  const customHeightId = `${idPrefix}customHeight`;
  const systemPromptId = `${idPrefix}systemPrompt`;
  const promptId = `${idPrefix}prompt`;

  return (
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
                onClick={() => onModelChange(m.id)}
                className={cn(
                  "min-w-0 rounded-lg border p-2.5 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:border-foreground/20 hover:bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium leading-snug">
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
          onClick={onSizeOpenToggle}
          className="flex w-full items-center justify-between gap-2 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground"
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
                    onClick={() => onSizeChange(s.id)}
                    className={cn(
                      "min-w-0 rounded-lg border p-2.5 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                        : "border-border hover:border-foreground/20 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-snug">
                          {s.label}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {isCustom
                            ? formatSizePixels(displaySize)
                            : `${s.aspectRatio} · ${formatSizePixels(s)}`}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
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
                      htmlFor={customWidthId}
                      className="text-[10px] text-muted-foreground"
                    >
                      宽度（px）
                    </Label>
                    <Input
                      id={customWidthId}
                      type="number"
                      inputMode="numeric"
                      min={MIN_IMAGE_DIMENSION}
                      max={MAX_IMAGE_DIMENSION}
                      step={1}
                      value={customWidthInput}
                      onChange={(event) =>
                        onCustomWidthInputChange(event.target.value)
                      }
                      onBlur={onSaveCustomSize}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={customHeightId}
                      className="text-[10px] text-muted-foreground"
                    >
                      高度（px）
                    </Label>
                    <Input
                      id={customHeightId}
                      type="number"
                      inputMode="numeric"
                      min={MIN_IMAGE_DIMENSION}
                      max={MAX_IMAGE_DIMENSION}
                      step={1}
                      value={customHeightInput}
                      onChange={(event) =>
                        onCustomHeightInputChange(event.target.value)
                      }
                      onBlur={onSaveCustomSize}
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
          onClick={onSystemPromptOpenToggle}
          className="flex w-full items-center justify-between text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>
            系统提示词
            <span className="ml-1 text-muted-foreground/70">（可选）</span>
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
              id={systemPromptId}
              placeholder="设定全局风格，例如：扁平插画风格、品牌主色为蓝色、图片中的文字使用中文…"
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              onBlur={onSaveSystemPrompt}
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
          onChange={onImageUpload}
        />
        {referenceImages.length > 0 && (
          <div className="grid w-fit grid-cols-[repeat(3,5rem)] gap-2">
            {referenceImages.map((image) => (
              <div
                key={image.id}
                className="relative w-20 overflow-hidden rounded-lg border border-border"
              >
                <button
                  type="button"
                  className="block aspect-square w-full cursor-zoom-in bg-muted"
                  onClick={() =>
                    onPreviewImage({
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
                    className="h-full w-full object-contain"
                  />
                </button>
                <div className="border-t border-border px-2 py-1.5 text-[10px] leading-tight text-muted-foreground">
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
                  onClick={() => onRemoveReferenceImage(image.id)}
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
                {referenceImages.length > 0 ? "继续添加参考图" : "上传参考图"}
              </>
            )}
          </Button>
        )}
        <p className="text-xs text-muted-foreground/70">
          支持 JPG / PNG / WebP / GIF，大图会自动压缩至 2048px 长边以内再发送。
        </p>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor={promptId}
          className="text-xs tracking-wider text-muted-foreground"
        >
          提示词
        </Label>
        <Textarea
          id={promptId}
          placeholder="描述你想生成的图像…"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[180px] resize-none text-sm"
        />
      </div>
    </div>
  );
}

export function GenerateImageButton({
  runningCount,
  canGenerate,
  onClick,
}: {
  runningCount: number;
  canGenerate: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      className="w-full"
      size="lg"
      disabled={!canGenerate}
    >
      {runningCount > 0
        ? `生成图像（${runningCount} 进行中）`
        : "生成图像"}
    </Button>
  );
}
