function getImageExtension(source: string, mimeType?: string): string {
  const mime = mimeType ?? source.match(/^data:image\/([\w+.-]+);/i)?.[1];
  if (mime) {
    const type = mime.replace(/^image\//i, "").toLowerCase();
    if (type === "jpeg" || type === "jpg") return ".jpg";
    if (type === "svg+xml") return ".svg";
    return `.${type}`;
  }

  const pathname = source.split("?")[0] ?? "";
  const match = pathname.match(/\.(avif|gif|jpe?g|png|svg|webp)$/i);
  if (!match) return ".png";
  const extension = match[1].toLowerCase();
  return extension === "jpeg" ? ".jpg" : `.${extension}`;
}

export function buildOpenPixFilename(
  timestamp: number,
  source: string,
  mimeType?: string,
): string {
  return `OpenPix-${timestamp}${getImageExtension(source, mimeType)}`;
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadImage(source: string, timestamp: number): Promise<void> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("图片下载失败，请稍后重试");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    triggerDownload(
      objectUrl,
      buildOpenPixFilename(timestamp, source, blob.type),
    );
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
