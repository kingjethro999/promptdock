"use client";

import { useEffect, useState } from "react";

export function useViewportHeightVar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--vvh",
        `${Math.round(vv.height)}px`,
      );
    set();
    vv.addEventListener("resize", set);
    return () => {
      vv.removeEventListener("resize", set);
      document.documentElement.style.removeProperty("--vvh");
    };
  }, []);
}

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (
      !vv ||
      !window.matchMedia("(max-width: 899px), (max-height: 520px)").matches
    ) {
      return;
    }
    const check = () =>
      setOpen(
        vv.height < window.innerHeight * 0.75 &&
          !!document.activeElement?.matches("input, textarea"),
      );
    vv.addEventListener("resize", check);
    document.addEventListener("focusout", check);
    return () => {
      vv.removeEventListener("resize", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return open;
}
