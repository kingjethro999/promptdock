"use client";

import { useEffect, useRef, useState } from "react";

export function useOnScreen<T extends Element = HTMLDivElement>(
  rootMargin = "200px",
) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, on };
}
