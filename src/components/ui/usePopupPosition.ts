"use client";

import { useState, useLayoutEffect } from "react";

export type PopupPositionOptions = {
  align?: "start" | "end" | "match";
  width?: number;
  gap?: number;
  isCoarse?: boolean;
};

export type PopupPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxH: number;
  side: "top" | "bottom";
};

export function usePopupPosition(
  open: boolean,
  trigger: React.RefObject<HTMLElement | null>,
  options?: PopupPositionOptions | boolean,
): PopupPosition | null {
  const [pos, setPos] = useState<PopupPosition | null>(null);

  const opts: PopupPositionOptions =
    typeof options === "boolean"
      ? { isCoarse: options }
      : options || {};

  const align = opts.align ?? (opts.width ? "start" : "match");
  const gap = opts.gap ?? 6;
  const fixedWidth = opts.width;
  const isCoarse = opts.isCoarse ?? false;

  useLayoutEffect(() => {
    if (!open || isCoarse) {
      setPos(null);
      return;
    }

    let raf = 0;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const below = vh - r.bottom - gap - 12;
      const above = r.top - gap - 12;
      const flip = below < 200 && above > below;

      const width = fixedWidth ?? r.width;
      let left = r.left;

      if (align === "match") {
        left = r.left;
      } else if (align === "end") {
        left = r.right - width;
      } else {
        left = r.left;
      }

      // Keep within viewport boundaries
      left = Math.max(12, Math.min(vw - width - 12, left));

      setPos({
        left,
        width,
        maxH: Math.max(140, Math.min(560, flip ? above : below)),
        side: flip ? "top" : "bottom",
        ...(flip ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }),
      });
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };

    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, trigger, isCoarse, align, gap, fixedWidth]);

  return pos;
}
