export const SIZE_PRESETS = [
  {
    id: "1:1",
    label: "正方形 1:1",
    platform: "通用 / 头像",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
  },
  {
    id: "3:4",
    label: "竖版 3:4",
    platform: "小红书笔记",
    aspectRatio: "3:4",
    width: 864,
    height: 1184,
  },
  {
    id: "9:16",
    label: "竖版 9:16",
    platform: "抖音 / 视频号",
    aspectRatio: "9:16",
    width: 768,
    height: 1344,
  },
  {
    id: "21:9",
    label: "超宽 21:9",
    platform: "公众号封面",
    aspectRatio: "21:9",
    width: 1536,
    height: 672,
  },
  {
    id: "16:9",
    label: "横版 16:9",
    platform: "公众号配图 / 横屏",
    aspectRatio: "16:9",
    width: 1344,
    height: 768,
  },
  {
    id: "4:3",
    label: "横版 4:3",
    platform: "传统图文",
    aspectRatio: "4:3",
    width: 1184,
    height: 864,
  },
  {
    id: "2:3",
    label: "竖版 2:3",
    platform: "竖屏海报",
    aspectRatio: "2:3",
    width: 832,
    height: 1248,
  },
  {
    id: "2048x640",
    label: "2048×640",
    platform: "球房前台LED",
    aspectRatio: "16:5",
    width: 2048,
    height: 640,
  },
  {
    id: "2304x640",
    label: "2304×640",
    platform: "球房前台LED",
    aspectRatio: "18:5",
    width: 2304,
    height: 640,
  },
  {
    id: "384x768",
    label: "384×768",
    platform: "竖屏窄屏",
    aspectRatio: "1:2",
    width: 512,
    height: 1024,
  },
  {
    id: "3840x2160",
    label: "3840×2160",
    platform: "4K 横屏",
    aspectRatio: "16:9",
    width: 2048,
    height: 1152,
  },
] as const;

export type SizePreset = (typeof SIZE_PRESETS)[number];

export type SizeOption = {
  id: string;
  label: string;
  platform: string;
  aspectRatio: string;
  width: number;
  height: number;
};

export const CUSTOM_SIZE_ID = "custom";
export const DEFAULT_SIZE_ID = "9:16";
export const DEFAULT_CUSTOM_WIDTH = 1024;
export const DEFAULT_CUSTOM_HEIGHT = 1024;
export const MIN_IMAGE_DIMENSION = 512;
export const MAX_IMAGE_DIMENSION = 2048;

export const CUSTOM_SIZE_OPTION: SizeOption = {
  id: CUSTOM_SIZE_ID,
  label: "自定义",
  platform: "自定义尺寸",
  aspectRatio: "1:1",
  width: DEFAULT_CUSTOM_WIDTH,
  height: DEFAULT_CUSTOM_HEIGHT,
};

/** 将目标像素等比缩放到 VLM 生图允许的 512–2048 范围内 */
export function scaleDimensionsToVlmRange(
  width: number,
  height: number,
): { width: number; height: number } {
  let w = width;
  let h = height;

  const longEdge = Math.max(w, h);
  if (longEdge > MAX_IMAGE_DIMENSION) {
    const ratio = MAX_IMAGE_DIMENSION / longEdge;
    w = Math.max(1, Math.round(w * ratio));
    h = Math.max(1, Math.round(h * ratio));
  }

  const shortEdge = Math.min(w, h);
  if (shortEdge < MIN_IMAGE_DIMENSION) {
    const ratio = MIN_IMAGE_DIMENSION / shortEdge;
    w = Math.max(1, Math.round(w * ratio));
    h = Math.max(1, Math.round(h * ratio));
  }

  const longEdgeAfter = Math.max(w, h);
  if (longEdgeAfter > MAX_IMAGE_DIMENSION) {
    const ratio = MAX_IMAGE_DIMENSION / longEdgeAfter;
    w = Math.max(1, Math.round(w * ratio));
    h = Math.max(1, Math.round(h * ratio));
  }

  return { width: w, height: h };
}

const API_ASPECT_RATIOS: Array<{ ratio: string; value: number }> = [
  { ratio: "1:1", value: 1 },
  { ratio: "1:2", value: 1 / 2 },
  { ratio: "2:3", value: 2 / 3 },
  { ratio: "3:2", value: 3 / 2 },
  { ratio: "3:4", value: 3 / 4 },
  { ratio: "4:3", value: 4 / 3 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "5:4", value: 5 / 4 },
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "16:9", value: 16 / 9 },
  { ratio: "21:9", value: 21 / 9 },
];

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const remain = x % y;
    x = y;
    y = remain;
  }
  return x || 1;
}

export function computeAspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export function resolveAspectRatioForApi(width: number, height: number): string {
  const simplified = computeAspectRatio(width, height);
  if (API_ASPECT_RATIOS.some((item) => item.ratio === simplified)) {
    return simplified;
  }

  const target = width / height;
  let closest = API_ASPECT_RATIOS[0];
  let smallestDiff = Math.abs(target - closest.value);

  for (const item of API_ASPECT_RATIOS) {
    const diff = Math.abs(target - item.value);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = item;
    }
  }

  return closest.ratio;
}

export function parseCustomDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  return num;
}

export function validateCustomDimensions(
  width: number,
  height: number,
): string | null {
  if (width < MIN_IMAGE_DIMENSION || width > MAX_IMAGE_DIMENSION) {
    return `宽度需在 ${MIN_IMAGE_DIMENSION}–${MAX_IMAGE_DIMENSION} 像素之间`;
  }
  if (height < MIN_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return `高度需在 ${MIN_IMAGE_DIMENSION}–${MAX_IMAGE_DIMENSION} 像素之间`;
  }
  return null;
}

export function resolveSizeOption(
  sizeId: string,
  customWidth?: number,
  customHeight?: number,
): SizeOption {
  if (sizeId === CUSTOM_SIZE_ID) {
    const width = customWidth ?? DEFAULT_CUSTOM_WIDTH;
    const height = customHeight ?? DEFAULT_CUSTOM_HEIGHT;
    return {
      ...CUSTOM_SIZE_OPTION,
      width,
      height,
      aspectRatio: resolveAspectRatioForApi(width, height),
    };
  }

  const preset =
    SIZE_PRESETS.find((item) => item.id === sizeId) ??
    SIZE_PRESETS.find((item) => item.id === DEFAULT_SIZE_ID)!;

  return preset;
}

export function formatSizePixels(option: Pick<SizeOption, "width" | "height">) {
  return `${option.width}×${option.height}`;
}

export function formatSizeOption(option: SizeOption) {
  return `${option.label} (${formatSizePixels(option)})`;
}

export function formatSizeRecord(option: SizeOption) {
  return `${formatSizeOption(option)} · ${option.platform}`;
}

export function formatSizeSummary(option: SizeOption) {
  return `${option.aspectRatio} · ${formatSizePixels(option)} · ${option.platform}`;
}

export const SIZE_CARD_OPTIONS: SizeOption[] = [
  ...SIZE_PRESETS,
  CUSTOM_SIZE_OPTION,
];
