"use client";

import { useState } from "react";
import * as m from "motion/react-m";
import { useScroll, useMotionValueEvent } from "motion/react";
import { dur, ease } from "../motion/tokens";

export function SmartHeader({
  children,
  menuOpen = false,
}: {
  children: React.ReactNode;
  menuOpen?: boolean;
}) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    const d = y - prev;
    if (Math.abs(d) < 6 || menuOpen) return;
    setHidden(d > 0 && y > 160);
  });

  return (
    <m.header
      className="landing-header site-header"
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{
        duration: hidden ? dur.exit : dur.base,
        ease: hidden ? ease.in : ease.out,
      }}
      onFocusCapture={() => setHidden(false)}
    >
      {children}
    </m.header>
  );
}
