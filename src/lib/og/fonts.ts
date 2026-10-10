import fs from "node:fs/promises";
import path from "node:path";

// Satori (inside next/og) supports TTF, OTF and WOFF. Prefer static TTF weights, not variable fonts.
let cache: Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]
> | null = null;

async function loadFont(filename: string): Promise<ArrayBuffer> {
  try {
    const filePath = path.join(process.cwd(), "src/lib/og/fonts", filename);
    const buf = await fs.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    const url = new URL(`./fonts/${filename}`, import.meta.url);
    const res = await fetch(url);
    return res.arrayBuffer();
  }
}

export function getFonts() {
  cache ??= Promise.all([
    loadFont("Inter-Regular.ttf"),
    loadFont("Inter-SemiBold.ttf"),
  ]).then(([reg, semi]) => [
    { name: "Inter", data: reg, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semi, weight: 600 as const, style: "normal" as const },
  ]);
  return cache;
}
