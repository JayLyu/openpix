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
] as const;

export type SizePreset = (typeof SIZE_PRESETS)[number];

export const DEFAULT_SIZE_ID = "9:16";

export function formatSizePixels(preset: SizePreset) {
  return `${preset.width}×${preset.height}`;
}

export function formatSizeOption(preset: SizePreset) {
  return `${preset.label} (${formatSizePixels(preset)})`;
}

export function formatSizeRecord(preset: SizePreset) {
  return `${formatSizeOption(preset)} · ${preset.platform}`;
}
