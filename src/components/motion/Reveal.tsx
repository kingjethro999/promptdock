"use client";

import * as m from "motion/react-m";
import type { CSSProperties, ReactNode } from "react";
import { ease } from "./tokens";
import { getPreset, type RevealKind } from "./presets";
import { useReveal } from "./useReveal";
import { useMotionEnv } from "./env";

type Tag = "div" | "section" | "article" | "li" | "p" | "span" | "figure";

export function Reveal({
  as = "div",
  kind = "rise",
  delay = 0,
  className,
  style,
  children,
}: {
  as?: Tag;
  kind?: RevealKind;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { reduced, compact } = useMotionEnv();
  const { ref, phase, forceVisible } = useReveal<HTMLDivElement>();
  const p = getPreset(kind, { reduced, compact });
  const Tag = m[as] as typeof m.div;

  return (
    <Tag
      ref={ref}
      data-reveal={kind}
      data-reveal-phase={phase}
      className={className}
      style={style}
      initial={p.hidden}
      animate={phase === "hidden" ? p.hidden : p.visible}
      transition={
        phase === "instant"
          ? { duration: 0 }
          : { duration: p.duration, ease: ease.out, delay }
      }
      onFocusCapture={forceVisible}
    >
      {children}
    </Tag>
  );
}
