"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVEAL_MARGIN } from "./tokens";

/** hidden → visible (animate in) | instant (already passed or forced: snap, no animation) */
export type RevealPhase = "hidden" | "visible" | "instant";

export function useReveal<T extends Element = HTMLDivElement>(
  margin = REVEAL_MARGIN,
) {
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<RevealPhase>("hidden");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setPhase("instant");
      return;
    }

    const checkAtBottom = () => {
      if (!el) return;
      if (
        typeof window !== "undefined" &&
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 250
      ) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setPhase("visible");
          cleanup();
        }
      }
    };

    const cleanup = () => {
      io.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("scroll", checkAtBottom);
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("visible");
          cleanup();
        } else if (
          entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
        ) {
          // Already ABOVE the viewport: anchor jump, restored scroll, or a fling past it.
          // Snap to final state so it can never stay hidden. No animation for content the user can't see.
          setPhase("instant");
          cleanup();
        } else if (
          typeof window !== "undefined" &&
          entry.boundingClientRect.top < window.innerHeight &&
          window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 250
        ) {
          // Bottom of page: negative bottom margin cannot be reached by further scrolling.
          setPhase("visible");
          cleanup();
        }
      },
      { rootMargin: margin, threshold: 0 }, // threshold 0: tall elements can never fail an "amount" test
    );
    io.observe(el);

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", checkAtBottom, { passive: true });
    }

    return () => cleanup();
  }, [margin]);

  // Keyboard users must never focus something invisible.
  const forceVisible = useCallback(
    () => setPhase((p) => (p === "hidden" ? "instant" : p)),
    [],
  );
  return { ref, phase, forceVisible };
}
