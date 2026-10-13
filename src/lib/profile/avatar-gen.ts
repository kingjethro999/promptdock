import type { Style, StyleDefinition } from "@dicebear/core";
import { type StyleId, DEFAULT_STYLE } from "./avatar-styles";

const DEFINITIONS: Record<StyleId, () => Promise<{ default: unknown }>> = {
  lorelei: () => import("@dicebear/styles/lorelei.json"),
  notionists: () => import("@dicebear/styles/notionists.json"),
  shapes: () => import("@dicebear/styles/shapes.json"),
};

let corePromise: Promise<typeof import("@dicebear/core")> | null = null;
const getCore = () =>
  (corePromise ??= import("@dicebear/core").catch((e) => {
    corePromise = null;
    throw e;
  }));

const styles = new Map<StyleId, Promise<Style>>();

export async function loadStyle(id: StyleId): Promise<Style> {
  let p = styles.get(id);
  if (!p) {
    p = Promise.all([getCore(), DEFINITIONS[id]()]).then(
      ([{ Style }, def]) => new Style(def.default as StyleDefinition),
    );
    p.catch(() => styles.delete(id));
    styles.set(id, p);
  }
  return p;
}

export function prefetchAvatarGen(id: StyleId = DEFAULT_STYLE) {
  if (typeof window === "undefined") return;
  const run = () => {
    void loadStyle(id).catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    (
      window as Window & {
        requestIdleCallback: (
          cb: () => void,
          opt?: { timeout: number },
        ) => void;
      }
    ).requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

export type Generated = {
  style: StyleId;
  seed: string;
  svg: string;
  uri: string;
};

export async function generate(
  style: StyleId,
  seed: string,
  backgroundColor: string[] = [],
): Promise<Generated> {
  const [{ Avatar }, s] = await Promise.all([getCore(), loadStyle(style)]);
  const a = new Avatar(s, {
    seed,
    size: 512,
    ...(backgroundColor.length > 0 ? { backgroundColor } : {}),
  });
  return {
    style,
    seed,
    svg: a.toString(),
    uri: a.toDataUri(),
  };
}

export const seedFor = (username: string, round: number, i: number) =>
  round === 0 && i === 0 ? username : `${username}:${round}:${i}`;

export async function generateSet(
  style: StyleId,
  username: string,
  round: number,
  colors: string[] = [],
): Promise<Generated[]> {
  const set = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      generate(style, seedFor(username, round, i), colors),
    ),
  );
  const seen = new Set<string>();
  return Promise.all(
    set.map(async (g, i) => {
      if (!seen.has(g.svg)) {
        seen.add(g.svg);
        return g;
      }
      return generate(style, `${g.seed}:dup${i}`, colors);
    }),
  );
}

export async function rasterize(svg: string, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image rasterization failed"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D canvas context");
    ctx.drawImage(img, 0, 0, size, size);

    const to = (type: string) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
    const webp = await to("image/webp");
    if (webp && webp.type === "image/webp") return webp;
    const png = await to("image/png");
    if (png) return png;
    throw new Error("Canvas toBlob failed");
  } finally {
    URL.revokeObjectURL(url);
  }
}
