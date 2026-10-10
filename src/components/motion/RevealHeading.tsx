"use client";

import * as m from "motion/react-m";
import { dur, ease } from "./tokens";
import { useReveal } from "./useReveal";
import { useMotionEnv } from "./env";

export function RevealHeading({
  children: text,
  as = "h2",
  delay = 0,
  className,
}: {
  children: string;
  as?: "h1" | "h2" | "h3";
  delay?: number;
  className?: string;
}) {
  const { reduced } = useMotionEnv();
  const { ref, phase, forceVisible } = useReveal<HTMLHeadingElement>();
  const words = text.split(" ");
  const step =
    reduced || phase === "instant" ? 0 : Math.min(0.05, 0.4 / words.length);
  const H = m[as] as typeof m.h2;

  return (
    <H
      ref={ref}
      aria-label={text} // screen readers get one clean string
      className={className}
      data-reveal="mask"
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
      {words.map((w, i) => (
        <span key={i} aria-hidden>
          <span className="reveal-mask">
            <m.span
              className="reveal-mask__inner"
              variants={
                reduced
                  ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                  : { hidden: { y: "110%" }, visible: { y: "0%" } }
              }
              transition={
                phase === "instant"
                  ? { duration: 0 }
                  : {
                      duration: reduced ? dur.fast : dur.slow,
                      ease: ease.out,
                    }
              }
            >
              {w}
            </m.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </H>
  );
}
