"use client";

import "lenis/dist/lenis.css";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type Lenis from "lenis";
import { useMotionEnv } from "../motion/env";

type ScrollApi = {
  lenis: Lenis | null;
  /** The ONLY way to scroll programmatically. */
  scrollTo: (target: string | HTMLElement) => void;
};

const Ctx = createContext<ScrollApi>({ lenis: null, scrollTo: () => {} });
export const useScrollApi = () => useContext(Ctx);

export function ScrollProvider({
  children,
  syncGsap = false,
}: {
  children: ReactNode;
  syncGsap?: boolean;
}) {
  const { reduced, fine } = useMotionEnv();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const enabled = fine && !reduced;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let teardown = () => {};

    (async () => {
      const { default: LenisCtor } = await import("lenis");
      const gsapMods = syncGsap
        ? await Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
        : null;
      if (disposed) return;

      const instance = new LenisCtor({
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      });

      if (gsapMods) {
        const [{ gsap }, { ScrollTrigger }] = gsapMods;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
        instance.on("scroll", ScrollTrigger.update);
        const tick = (t: number) => instance.raf(t * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        teardown = () => {
          gsap.ticker.remove(tick);
          instance.destroy();
        };
      } else {
        let id = 0;
        const loop = (t: number) => {
          instance.raf(t);
          id = requestAnimationFrame(loop);
        };
        id = requestAnimationFrame(loop);
        teardown = () => {
          cancelAnimationFrame(id);
          instance.destroy();
        };
      }

      document.documentElement.dataset.smoothScroll = "lenis";
      setLenis(instance);
    })();

    return () => {
      disposed = true;
      teardown();
      delete document.documentElement.dataset.smoothScroll;
      setLenis(null);
    };
  }, [enabled, syncGsap]);

  const api = useMemo<ScrollApi>(
    () => ({
      lenis,
      scrollTo: (target) => {
        const el =
          typeof target === "string"
            ? document.querySelector<HTMLElement>(target)
            : target;
        if (!el) return;
        const pad =
          parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop,
          ) || 0;
        const dest = el.getBoundingClientRect().top + window.scrollY - pad;
        const far = Math.abs(dest - window.scrollY) > window.innerHeight * 2;

        if (lenis) {
          lenis.scrollTo(dest, { immediate: far, lock: true });
        } else {
          window.scrollTo({
            top: dest,
            behavior: far || reduced ? "auto" : "smooth",
          });
        }

        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      },
    }),
    [lenis, reduced],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
