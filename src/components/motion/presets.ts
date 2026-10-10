import type { TargetAndTransition } from "motion/react";
import { dist, dur } from "./tokens";

export type RevealKind = "rise" | "settle" | "edge" | "depth" | "fade";
export type Preset = {
  hidden: TargetAndTransition;
  visible: TargetAndTransition;
  duration: number;
};

export function getPreset(
  kind: RevealKind,
  { reduced, compact }: { reduced: boolean; compact: boolean },
): Preset {
  if (reduced)
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      duration: dur.fast,
    };
  const k = compact ? 0.7 : 1; // smaller travel on small screens
  switch (kind) {
    case "settle":
      return {
        hidden: { opacity: 0, scale: 1.04 },
        visible: { opacity: 1, scale: 1 },
        duration: dur.slow,
      };
    case "edge":
      return {
        hidden: { opacity: 0, x: -dist.md * k },
        visible: { opacity: 1, x: 0 },
        duration: dur.base,
      };
    case "depth":
      return {
        hidden: {
          opacity: 0,
          y: dist.md * k,
          rotateX: compact ? 0 : 8,
          scale: 0.98,
        },
        visible: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
        duration: dur.slow,
      };
    case "fade":
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        duration: dur.base,
      };
    default:
      return {
        hidden: { opacity: 0, y: dist.sm * k },
        visible: { opacity: 1, y: 0 },
        duration: dur.base,
      };
  }
}
