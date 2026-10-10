"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingDetails, LandingFooter, LandingProof } from "./LandingDetails";
import LandingHero from "./LandingHero";
import ActionLink from "@/components/ui/ActionLink";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { RevealHeading } from "@/components/motion/RevealHeading";
import { ScrollProvider } from "@/components/scroll/ScrollProvider";
import { ScrollProgress } from "@/components/scroll/ScrollProgress";
import { SmartHeader } from "@/components/scroll/SmartHeader";
import { AnchorLink } from "@/components/scroll/AnchorLink";

const SignatureSequence = dynamic(() => import("./SignatureSequence"), {
  ssr: false,
  loading: () => <div className="sequence" style={{ minHeight: "500px" }} />,
});

export default function LandingPage() {
  return (
    <ScrollProvider syncGsap={true}>
      <div className="landing-page">
        {/* Transform-only Scroll Progress Bar */}
        <ScrollProgress />

        {/* Directional Smart Header */}
        <SmartHeader>
          <Link className="landing-logo" href="/" aria-label="PromptDock home">
            <span className="landing-logo-mark">✳</span> prompt<span>dock</span>
          </Link>
          <nav aria-label="Landing navigation">
            <AnchorLink href="#how-it-works">How it works</AnchorLink>
            <AnchorLink href="#features">Features</AnchorLink>
            <AnchorLink href="#your-keys">Your keys</AnchorLink>
          </nav>
          <div className="landing-header-actions">
            <Link className="landing-signin" href="/auth?mode=login">
              Sign in
            </Link>
            <ActionLink
              className="landing-small-cta"
              href="/auth?mode=register"
            >
              Get started <span>↗</span>
            </ActionLink>
          </div>
        </SmartHeader>

        <main id="top">
          {/* LCP-safe choreographed hero */}
          <LandingHero />

          {/* Supported platforms proof */}
          <Reveal kind="fade">
            <LandingProof />
          </Reveal>

          {/* How It Works with word-mask heading and budget-capped stagger */}
          <section className="landing-how" id="how-it-works">
            <div className="landing-section-intro">
              <span className="landing-kicker">HOW IT WORKS</span>
              <RevealHeading as="h2">
                From “I have an idea” to “I know what to ask.”
              </RevealHeading>
              <Reveal kind="rise" delay={0.1}>
                <p>
                  You bring the thought. PromptDock helps turn it into clear
                  instructions without asking you to become a prompt engineer.
                </p>
              </Reveal>
            </div>

            <Stagger as="div" className="landing-step-grid">
              <StaggerItem as="article" kind="rise">
                <span className="landing-step-number">01</span>
                <div className="landing-step-icon">✎</div>
                <h3>Say it naturally</h3>
                <p>
                  Type a messy thought or dictate it. A sentence is enough to
                  start.
                </p>
              </StaggerItem>

              <StaggerItem as="article" kind="rise">
                <span className="landing-step-number">02</span>
                <div className="landing-step-icon">✳</div>
                <h3>See what matters</h3>
                <p>
                  AI understands the goal, ranks the focus areas, and flags
                  missing details.
                </p>
              </StaggerItem>

              <StaggerItem as="article" kind="rise">
                <span className="landing-step-number">03</span>
                <div className="landing-step-icon">↗</div>
                <h3>Make it yours</h3>
                <p>
                  Save what works, share it, or copy it into your favorite AI
                  tool.
                </p>
              </StaggerItem>
            </Stagger>
          </section>

          {/* GSAP matchMedia-gated pinned/lite Signature Sequence */}
          <SignatureSequence />

          {/* Features, BYOK, FAQ, and Sponsor */}
          <LandingDetails />

          {/* Final CTA */}
          <section className="landing-final">
            <Reveal kind="rise">
              <div>
                <span className="landing-kicker">
                  THE NEXT GOOD PROMPT STARTS HERE
                </span>
                <h2>What have you been thinking about?</h2>
                <p>
                  Bring the half-formed idea. Leave with a prompt that knows where
                  to focus.
                </p>
              </div>
            </Reveal>
            <Reveal kind="settle" delay={0.1}>
              <ActionLink
                className="landing-primary-cta"
                href="/auth?mode=register"
              >
                Start with an idea <span>↗</span>
              </ActionLink>
            </Reveal>
          </section>
        </main>

        <LandingFooter />
      </div>
    </ScrollProvider>
  );
}
