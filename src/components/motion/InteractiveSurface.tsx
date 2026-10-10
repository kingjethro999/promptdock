"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import * as m from "motion/react-m";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import { spring } from "./tokens";
import { useMotionEnv } from "./env";

export function InteractiveSurface({
  children,
  max = 5,
  className,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const { reduced, fine } = useMotionEnv();
  const enabled = fine && !reduced;
  const frame = useRef<HTMLDivElement>(null); // UNtransformed wrapper: measuring the tilted node would feed back and jitter
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(
    useTransform(px, [-0.5, 0.5], [-max, max]),
    spring.depth,
  );
  const rotateX = useSpring(
    useTransform(py, [-0.5, 0.5], [max, -max]),
    spring.depth,
  );

  const onMove = (e: PointerEvent) => {
    if (!enabled || e.pointerType === "touch" || !frame.current) return;
    const r = frame.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div
      ref={frame}
      className={className}
      style={{ perspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      <m.div style={enabled ? { rotateX, rotateY } : undefined}>
        {children}
      </m.div>
    </div>
  );
}
