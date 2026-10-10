"use client";

import { useEffect } from "react";
import { useScrollApi } from "./ScrollProvider";

export function useScrollLock(open: boolean) {
  const { lenis } = useScrollApi();
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
      lenis?.start();
    };
  }, [open, lenis]);
}
