export type Direction = "diagonal" | "horizontal";

export type Settings = {
  text: string;
  direction: Direction;
  size: number;
  opacity: number;
  spacing: number;
};

export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, settings: Settings) {
  const label = settings.text.trim();
  if (!label) return;

  // Scale with the image, while keeping text small on typical document scans.
  const fontSize = Math.max(9, Math.min(28, (width / 1200) * settings.size));
  ctx.save();
  ctx.fillStyle = `rgba(75, 79, 82, ${settings.opacity / 100})`;
  ctx.font = `500 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(label).width;
  const gapFactor = [0.55, 0.85, 1.2][settings.spacing] ?? 0.85;
  const stepX = textWidth + Math.max(fontSize * 5, textWidth * gapFactor);
  const stepY = fontSize * ([5, 7, 10][settings.spacing] ?? 7);
  const angle = settings.direction === "diagonal" ? -Math.PI / 9 : 0;
  const radius = Math.hypot(width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  for (let y = -radius; y <= radius; y += stepY) {
    const row = Math.round((y + radius) / stepY);
    for (let x = -radius - stepX; x <= radius; x += stepX) {
      ctx.fillText(label, x + (row % 2) * stepX / 2, y);
    }
  }
  ctx.restore();
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This browser could not open the image."));
    image.src = url;
  });
}

export function imageMime(file: File): string {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/png";
}

export function outputName(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  return `${base}-watermarked.${extension}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not export this image.")), mime, 0.94);
  });
}

// ZIP store format avoids an extra package and does not recompress JPEG/PNG data.
const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function createZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const name = encoder.encode(file.name);
    const crc = crc32(data);
    const header = new ArrayBuffer(30 + name.length);
    const h = new DataView(header);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    new Uint8Array(header, 30).set(name);
    chunks.push(header, data);

    const record = new ArrayBuffer(46 + name.length);
    const v = new DataView(record);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0x0800, true);
    v.setUint32(16, crc, true);
    v.setUint32(20, data.length, true);
    v.setUint32(24, data.length, true);
    v.setUint16(28, name.length, true);
    v.setUint32(42, offset, true);
    new Uint8Array(record, 46).set(name);
    central.push(record);
    offset += header.byteLength + data.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + (chunk as ArrayBuffer).byteLength, 0);
  const end = new ArrayBuffer(22);
  const e = new DataView(end);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}
