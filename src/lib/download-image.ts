function getImageExtension(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([\w+.-]+);/i);
  if (!match) return ".png";
  const type = match[1].toLowerCase();
  if (type === "jpeg" || type === "jpg") return ".jpg";
  if (type === "svg+xml") return ".svg";
  return `.${type}`;
}

export function buildOpenPixFilename(timestamp: number, dataUrl: string): string {
  return `OpenPix-${timestamp}${getImageExtension(dataUrl)}`;
}

export function downloadImage(dataUrl: string, timestamp: number): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = buildOpenPixFilename(timestamp, dataUrl);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
