const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * 参考图压缩策略（面向 GPT-5.4 Image 2 / Gemini 3.1 Flash Image 等高级模型）
 * - 优先保留 2048px 长边，尽量保留编辑/图生图细节
 * - 体积仍超限时再降至 1536 / 1024，避免请求过大
 */
const MAX_LONG_EDGE = 2048;
const FALLBACK_LONG_EDGES = [1536, 1024] as const;
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const INITIAL_QUALITY = 0.88;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;

export const MAX_REFERENCE_IMAGES = 3;

export type ProcessedImage = {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  name: string;
};

function scaleToMaxLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }
  const ratio = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取图片，请换一张试试"));
    };
    image.src = objectUrl;
  });
}

function renderToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片处理");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function encodeImage(
  image: HTMLImageElement,
  maxLongEdge: number,
): { dataUrl: string; width: number; height: number } {
  const { width, height } = scaleToMaxLongEdge(
    image.naturalWidth,
    image.naturalHeight,
    maxLongEdge,
  );

  for (const quality of iterateQuality(INITIAL_QUALITY)) {
    const dataUrl = renderToDataUrl(image, width, height, quality);
    if (dataUrl.length <= MAX_BASE64_LENGTH) {
      return { dataUrl, width, height };
    }
  }

  throw new Error("图片压缩后仍然过大，请换一张更小的图片");
}

function* iterateQuality(start: number): Generator<number> {
  for (let q = start; q >= MIN_QUALITY; q -= QUALITY_STEP) {
    yield Number(q.toFixed(2));
  }
}

export async function processReferenceImage(file: File): Promise<ProcessedImage> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP、GIF 格式");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("图片不能超过 30MB");
  }

  const image = await loadImageElement(file);

  for (const maxLongEdge of [MAX_LONG_EDGE, ...FALLBACK_LONG_EDGES]) {
    try {
      const encoded = encodeImage(image, maxLongEdge);
      return {
        id: crypto.randomUUID(),
        ...encoded,
        name: file.name,
      };
    } catch {
      continue;
    }
  }

  throw new Error("无法将图片压缩到可发送的大小，请换一张更小的图片");
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  if (url.startsWith("data:")) {
    return loadImageFromDataUrl(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("无法读取图片，请稍后重试");
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("仅支持图片格式");
  }

  const file = new File([blob], "reference.jpg", {
    type: blob.type || "image/jpeg",
  });
  return loadImageElement(file);
}

function encodeProcessedImage(
  image: HTMLImageElement,
  name: string,
): ProcessedImage {
  for (const maxLongEdge of [MAX_LONG_EDGE, ...FALLBACK_LONG_EDGES]) {
    try {
      const encoded = encodeImage(image, maxLongEdge);
      return {
        id: crypto.randomUUID(),
        ...encoded,
        name,
      };
    } catch {
      continue;
    }
  }

  throw new Error("无法将图片压缩到可发送的大小，请换一张更小的图片");
}

export async function processReferenceImageFromUrl(
  url: string,
  name = "reference.jpg",
): Promise<ProcessedImage> {
  const image = await loadImageFromUrl(url);
  return encodeProcessedImage(image, name);
}

export function formatImageSize(dataUrl: string): string {
  const bytes = Math.round((dataUrl.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const THUMB_SIZE = 128;

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法生成缩略图"));
    image.src = dataUrl;
  });
}

function renderContainThumbnail(
  source: HTMLImageElement,
  size: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片处理");

  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(
    size / source.naturalWidth,
    size / source.naturalHeight,
  );
  const width = source.naturalWidth * scale;
  const height = source.naturalHeight * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  ctx.drawImage(source, x, y, width, height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function createReferenceThumbnails(
  images: Pick<ProcessedImage, "id" | "name" | "dataUrl">[],
): Promise<Array<{ id: string; name: string; dataUrl: string }>> {
  const thumbs = [];
  for (const image of images) {
    const element = await loadImageFromDataUrl(image.dataUrl);
    thumbs.push({
      id: image.id,
      name: image.name,
      dataUrl: renderContainThumbnail(element, THUMB_SIZE),
    });
  }
  return thumbs;
}
