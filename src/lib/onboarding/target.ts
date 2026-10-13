import { useEffect, useLayoutEffect, useState } from "react";
import type { Placement } from "./types";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function waitForTarget(
  name: string,
  timeout = 1500,
): Promise<HTMLElement | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const sel = `[data-tour="${CSS.escape(name)}"]`;
  const visible = (el: HTMLElement | null) =>
    !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== "hidden";
  const find = () => {
    const el = document.querySelector<HTMLElement>(sel);
    return visible(el) ? el : null;
  };
  return new Promise((resolve) => {
    const first = find();
    if (first) return resolve(first);
    let t: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      mo.disconnect();
      if (t) clearTimeout(t);
    };
    const mo = new MutationObserver(() => {
      const el = find();
      if (el) {
        done();
        resolve(el);
      }
    });
    t = setTimeout(() => {
      done();
      resolve(null);
    }, timeout);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "data-open"],
    });
  });
}

export function useTargetRect(el: HTMLElement | null, pad = 8) {
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!el || typeof window === "undefined") {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const n = {
          x: Math.round(r.left - pad),
          y: Math.round(r.top - pad),
          w: Math.round(r.width + pad * 2),
          h: Math.round(r.height + pad * 2),
        };
        setRect((p) =>
          p && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h ? p : n,
        );
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [el, pad]);

  return rect;
}

export function placeCard(
  rect: { x: number; y: number; w: number; h: number } | null,
  card: { w: number; h: number },
  pref: Placement = "bottom",
  vw: number,
  vh: number,
) {
  const M = 16;
  const GAP = 14;
  if (!rect) {
    return {
      x: (vw - card.w) / 2,
      y: (vh - card.h) / 2,
      side: "center" as const,
    };
  }
  const room = {
    right: vw - (rect.x + rect.w) - M,
    left: rect.x - M,
    bottom: vh - (rect.y + rect.h) - M,
    top: rect.y - M,
  };
  const need = {
    right: card.w + GAP,
    left: card.w + GAP,
    bottom: card.h + GAP,
    top: card.h + GAP,
  };
  const order =
    pref === "auto"
      ? (["right", "bottom", "left", "top"] as const)
      : ([pref, "right", "bottom", "left", "top"] as const);
  const side = order.find((s) => room[s] >= need[s]) ?? "bottom";
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), Math.max(lo, hi));
  const x =
    side === "right"
      ? rect.x + rect.w + GAP
      : side === "left"
        ? rect.x - card.w - GAP
        : clamp(rect.x + rect.w / 2 - card.w / 2, M, vw - card.w - M);
  const y =
    side === "bottom"
      ? rect.y + rect.h + GAP
      : side === "top"
        ? rect.y - card.h - GAP
        : clamp(rect.y + rect.h / 2 - card.h / 2, M, vh - card.h - M);
  return {
    x: clamp(x, M, Math.max(M, vw - card.w - M)),
    y: clamp(y, M, Math.max(M, vh - card.h - M)),
    side,
  };
}
