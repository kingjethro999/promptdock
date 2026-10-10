"use client";

import * as m from "motion/react-m";
import { useScroll, useSpring } from "motion/react";
import { spring } from "../motion/tokens";
import { useMotionEnv } from "../motion/env";

export function ScrollProgress() {
  const { reduced } = useMotionEnv();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, {
    ...spring.settle,
    restDelta: 0.001,
  });

  return (
    <m.div
      aria-hidden
      className="scroll-progress"
      style={{
        scaleX: reduced ? scrollYProgress : smooth,
        transformOrigin: "0 50%",
      }}
    />
  );
}
