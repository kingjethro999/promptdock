"use client";

import { useRef, type ReactNode } from "react";
import * as m from "motion/react-m";
import { useScroll, useTransform } from "motion/react";
import { useMotionEnv } from "./env";

export function Parallax({
  children,
  distance = 24,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const { reduced, compact } = useMotionEnv();
  const ref = useRef<HTMLDivElement>(null);
  const enabled = !reduced && !compact;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Motion values update outside React's render cycle: zero re-renders while scrolling.
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    enabled ? [distance, -distance] : [0, 0],
  );

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden" }}>
      {/* media inside should be oversized by about 2×distance (or scale ~1.08) so edges never show */}
      <m.div style={{ y }}>{children}</m.div>
    </div>
  );
}
