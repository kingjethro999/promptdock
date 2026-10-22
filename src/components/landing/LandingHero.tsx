"use client";

import ActionLink from "@/components/ui/ActionLink";
import { AnchorLink } from "@/components/scroll/AnchorLink";
import { Glyph, Icon } from "@/components/ui";
import LandingDemo from "./LandingDemo";

export default function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <div className="evolution-badge">
          <span className="evolution-badge__pill">A NEW LOOK</span>
          <span>Built for the way ideas actually begin</span>
        </div>

        <div className="landing-eyebrow">
          <Glyph name="spark" size={14} /> THE IDEA-TO-PROMPT WORKSPACE
        </div>

        <h1>
          Make more of your <em>first thought.</em>
        </h1>

        <p>
          Turn rough ideas into clear AI prompts. Refine, organize, and save
          what works in your prompt library, then use it with the AI tools you
          already know.
        </p>

        <div className="landing-hero-actions">
          <ActionLink
            className="landing-primary-cta"
            href="/auth?mode=register"
          >
            Start shaping ideas <Icon name="arrow-up-right" size={15} />
          </ActionLink>
          <AnchorLink className="landing-secondary-cta" href="#how-it-works">
            See how it works <Icon name="arrow-down" size={14} />
          </AnchorLink>
        </div>
      </div>

      <div className="landing-hero-showcase">
        <div className="landing-hero-preview">
          <LandingDemo />
        </div>

        <div className="landing-hero-tiles">
          <article className="landing-hero-tile">
            <span className="landing-hero-tile__index">TAKE IT FURTHER</span>
            <span className="landing-hero-tile__mark" aria-hidden="true">
              <Glyph name="command" size={28} />
            </span>
            <h2>One prompt. Your choice of AI.</h2>
            <p>Copy the result or use a supported model in your workspace.</p>
            <AnchorLink href="#models">
              Explore models <Icon name="arrow-up-right" size={14} />
            </AnchorLink>
          </article>
        </div>
      </div>
    </section>
  );
}
