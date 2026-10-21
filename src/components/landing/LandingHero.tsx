"use client";

import * as m from "motion/react-m";
import { dur, ease } from "@/components/motion/tokens";
import { getPreset, type RevealKind } from "@/components/motion/presets";
import { useMotionEnv } from "@/components/motion/env";
import ActionLink from "@/components/ui/ActionLink";
import { AnchorLink } from "@/components/scroll/AnchorLink";
import { Glyph, Icon } from "@/components/ui";
import LandingDemo from "./LandingDemo";

const group = {
  hidden: {},
  visible: { transition: { delayChildren: 0.05, staggerChildren: 0.09 } },
};

export default function LandingHero() {
  const { reduced, compact } = useMotionEnv();

  const item = (kind: RevealKind) => {
    const p = getPreset(kind, { reduced, compact });
    return {
      hidden: p.hidden,
      visible: {
        ...p.visible,
        transition: { duration: p.duration, ease: ease.out },
      },
    };
  };

  return (
    <m.section
      variants={group}
      initial="hidden"
      animate="visible"
      className="landing-hero"
      data-reveal="hero-group"
    >
      {/* Ambient Living Mesh */}
      <div className="hero-ambient-glow" aria-hidden="true" />

      <div className="landing-hero-copy">
        {/* Evolution Supporting Tag */}
        <m.div
          variants={item("rise")}
          className="evolution-badge"
          data-reveal-item="rise"
        >
          <span className="evolution-badge__pill">
            <span className="evolution-badge__sparkle">
              <Glyph name="star" size={12} />
            </span>{" "}
            EVOLUTION
          </span>
          <span>A clearer way to make your ideas useful.</span>
        </m.div>

        <m.div
          variants={item("rise")}
          className="landing-eyebrow"
          data-reveal-item="rise"
        >
          <Glyph name="spark" size={14} /> THE IDEA-TO-PROMPT WORKSPACE
        </m.div>

        {/* LCP element: transform-only settle (y 14 -> 0), opacity stays 1 so it is measured on the first paint */}
        <m.h1
          variants={{
            hidden: { y: reduced ? 0 : 14 },
            visible: {
              y: 0,
              transition: { duration: dur.base + 0.1, ease: ease.out },
            },
          }}
          data-reveal-item="lcp-settle"
        >
          Your next great prompt starts <em>somewhere messy.</em>
        </m.h1>

        <m.p variants={item("rise")} data-reveal-item="rise">
          Bring the thought as it is. Shape it into a focused prompt, keep what
          works, and use it with the AI tools you already know.
        </m.p>

        <m.div
          variants={item("rise")}
          className="landing-hero-actions"
          data-reveal-item="rise"
        >
          <ActionLink
            className="landing-primary-cta"
            href="/auth?mode=register"
          >
            Start shaping ideas{" "}
            <Icon
              name="arrow-up-right"
              size={14}
              style={{ display: "inline-block", verticalAlign: "middle" }}
            />
          </ActionLink>
          <AnchorLink className="landing-secondary-cta" href="#how-it-works">
            See how it works{" "}
            <Icon
              name="arrow-down"
              size={14}
              style={{ display: "inline-block", verticalAlign: "middle" }}
            />
          </AnchorLink>
        </m.div>

        <m.div
          variants={item("rise")}
          className="landing-hero-note"
          data-reveal-item="rise"
        >
          <span className="landing-note-stars" aria-hidden="true">
            ✳
          </span>
          <span>Write naturally. Refine deliberately. Prompt anywhere.</span>
        </m.div>
      </div>

      <m.div variants={item("depth")} data-reveal-item="depth">
        <LandingDemo />
      </m.div>
    </m.section>
  );
}
