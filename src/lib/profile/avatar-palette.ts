export function cssToHex(css: string): string {
  if (typeof document === "undefined") return "#3b82f6";
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#3b82f6";
  ctx.fillStyle = "#000000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function readTones(count = 6): string[] {
  if (typeof document === "undefined") {
    return ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];
  }
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
  document.body.append(probe);
  const out = Array.from({ length: count }, (_, i) => {
    probe.setAttribute("data-tone", String(i));
    return getComputedStyle(probe).backgroundColor;
  });
  probe.remove();
  const unique = [...new Set(out)].filter(Boolean);
  return unique.length >= 3
    ? unique
    : ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];
}

export function paletteHex(count = 6): string[] {
  const out = readTones(count).map(cssToHex);
  const filtered = [...new Set(out)].filter((h) => h !== "#000000");
  return filtered.length > 0
    ? filtered
    : ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
}

export const USE_BRAND_BACKGROUND = true;
