"use client";

import { Children, createContext, useContext, type ReactNode } from "react";
import * as m from "motion/react-m";
import { ease, staggerStep } from "./tokens";
import { getPreset, type RevealKind } from "./presets";
import { useReveal } from "./useReveal";
import { useMotionEnv } from "./env";

type Tag = "div" | "ul" | "ol" | "section" | "li" | "article";
const GroupCtx = createContext({ instant: false });

export function Stagger({
  as = "div",
  delay = 0,
  className,
  children,
}: {
  as?: Tag;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const { reduced } = useMotionEnv();
  const { ref, phase, forceVisible } = useReveal<HTMLDivElement>();
  const step =
    reduced || phase === "instant" ? 0 : staggerStep(Children.count(children));
  const Tag = m[as] as typeof m.div;

  return (
    <Tag
      ref={ref}
      className={className}
      data-reveal-group
      data-reveal-phase={phase}
      initial="hidden"
      animate={phase === "hidden" ? "hidden" : "visible"}
      variants={{
        hidden: {},
        visible: {
          transition: { delayChildren: delay, staggerChildren: step },
        },
      }}
      onFocusCapture={forceVisible}
    >
      <GroupCtx.Provider value={{ instant: phase === "instant" }}>
        {children}
      </GroupCtx.Provider>
    </Tag>
  );
}

export function StaggerItem({
  as = "div",
  kind = "rise",
  className,
  children,
}: {
  as?: Tag;
  kind?: RevealKind;
  className?: string;
  children: ReactNode;
}) {
  const { reduced, compact } = useMotionEnv();
  const { instant } = useContext(GroupCtx);
  const p = getPreset(kind, { reduced, compact });
  const Tag = m[as] as typeof m.div;

  return (
    <Tag
      className={className}
      data-reveal-item={kind}
      variants={{
        hidden: p.hidden,
        visible: {
          ...p.visible,
          transition: instant
            ? { duration: 0 }
            : { duration: p.duration, ease: ease.out },
        },
      }}
    >
      {children}
    </Tag>
  );
}
