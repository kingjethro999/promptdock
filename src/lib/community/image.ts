export type ImageKind = "avatar" | "banner";
const OUT = {
  avatar: { w: 512, h: 512, q: 0.9 },
  banner: { w: 2400, h: 800, q: 0.86 },
} as const;
export const ASPECT = { avatar: 1, banner: 3 } as const;
export class ImageError extends Error {
  constructor(public code: "unreadable") {
    super(code);
  }
}

/** Decode with a pixel cap, so a 100 MB (or 12000 px) source can't exhaust memory. Small images are never upscaled. */
export async function decode(file: File, maxSide = 4096): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new ImageError("unreadable"));
      img.src = url;
    });
    const scale = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth, img.naturalHeight),
    );
    try {
      return await createImageBitmap(
        file,
        scale < 1
          ? {
              resizeWidth: Math.round(img.naturalWidth * scale),
              resizeHeight: Math.round(img.naturalHeight * scale),
              resizeQuality: "high",
            }
          : undefined,
      );
    } catch {
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return await createImageBitmap(c);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type Crop = { zoom: number; cx: number; cy: number };
export function cropRect(srcW: number, srcH: number, aspect: number, c: Crop) {
  const base =
    srcW / srcH > aspect
      ? { w: srcH * aspect, h: srcH }
      : { w: srcW, h: srcW / aspect };
  const w = base.w / c.zoom;
  const h = base.h / c.zoom;
  return {
    x: Math.min(Math.max(c.cx - w / 2, 0), Math.max(0, srcW - w)),
    y: Math.min(Math.max(c.cy - h / 2, 0), Math.max(0, srcH - h)),
    w: Math.min(w, srcW),
    h: Math.min(h, srcH),
  };
}

export async function encode(
  bitmap: ImageBitmap,
  rect: ReturnType<typeof cropRect>,
  kind: ImageKind,
): Promise<Blob> {
  const { w, h, q } = OUT[kind];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  const to = (type: string) =>
    new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await to("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await to("image/jpeg");
  if (!blob) throw new ImageError("unreadable");
  return blob;
}
