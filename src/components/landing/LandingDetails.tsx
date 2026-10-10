"use client";

import Link from "next/link";
import Image from "next/image";
import FeedbackDialog from "./FeedbackDialog";
import ActionLink from "@/components/ui/ActionLink";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { RevealHeading } from "@/components/motion/RevealHeading";

export function LandingProof() {
  return (
    <section className="landing-proof" aria-label="Supported platforms">
      <span>ONE WORKSPACE, EVERY AI TOOL</span>
      <div>
        <strong>
          <Image
            className="brand-icon"
            src="/assets/brands/openai.png"
            width={17}
            height={17}
            alt=""
          />{" "}
          ChatGPT
        </strong>
        <strong>
          <Image
            className="brand-icon"
            src="/assets/brands/anthropic.png"
            width={17}
            height={17}
            alt=""
          />{" "}
          Claude
        </strong>
        <strong>
          <Image
            className="brand-icon"
            src="/assets/brands/gemini.png"
            width={17}
            height={17}
            alt=""
          />{" "}
          Gemini
        </strong>
        <strong>+ wherever you prompt</strong>
      </div>
    </section>
  );
}

export function LandingDetails() {
  return (
    <>
      <section className="landing-features" id="features">
        <div className="landing-section-intro">
          <span className="landing-kicker">BUILT FOR YOUR FLOW</span>
          <RevealHeading as="h2">
            Ideas move quickly. Your workspace should too.
          </RevealHeading>
        </div>

        <Stagger as="div" className="landing-feature-grid">
          <StaggerItem as="article" className="feature-main" kind="depth">
            <span>✳ IDEA TO PROMPT</span>
            <h3>Start before you know exactly what you want.</h3>
            <p>
              PromptDock turns unstructured intent into a goal, a suggested
              flow, and priorities that tell the AI where to spend its effort.
            </p>
            <div className="feature-visual">
              <span>rough idea</span>
              <i>→</i>
              <span>clear direction</span>
              <i>→</i>
              <span>ready-to-use prompt</span>
            </div>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <span className="feature-symbol">◉</span>
            <h3>Speak it out</h3>
            <p>
              Record a thought, review the transcription, and send it into the
              same idea-to-prompt flow.
            </p>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <span className="feature-symbol">▦</span>
            <h3>Save and share</h3>
            <p>
              Keep prompts in your library. Make one public so anyone can copy
              it, or sign in to save a personal version.
            </p>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <span className="feature-symbol">⌘</span>
            <h3>Keep control</h3>
            <p>
              Fine-tune the details, copy the final prompt, or export it as
              Markdown.
            </p>
          </StaggerItem>
        </Stagger>
      </section>

      <section className="landing-keys" id="your-keys">
        <Reveal kind="depth" className="landing-keys-orbit">
          ✳<span>YOUR MODEL</span>
          <small>YOUR KEY</small>
        </Reveal>

        <div>
          <span className="landing-kicker">YOUR AI, YOUR WAY</span>
          <RevealHeading as="h2">
            Bring your own key. Choose your model.
          </RevealHeading>
          <Reveal kind="rise" delay={0.1}>
            <p>
              Connect your Groq or Gemini key in settings, pick the model you
              prefer, and keep shaping prompts in the same workspace. Your key is
              encrypted on the server and never shown again after saving.
            </p>
          </Reveal>
          <Reveal kind="rise" delay={0.15}>
            <ActionLink
              className="landing-outline-cta"
              href="/auth?mode=register"
            >
              Set up your workspace <span>↗</span>
            </ActionLink>
          </Reveal>
        </div>
      </section>

      <section className="landing-faq" id="questions">
        <div className="landing-section-intro">
          <span className="landing-kicker">GOOD TO KNOW</span>
          <RevealHeading as="h2">A few quick answers.</RevealHeading>
        </div>

        <Stagger as="div" className="landing-faq-grid">
          <StaggerItem as="article" kind="rise">
            <h3>What is PromptDock?</h3>
            <p>
              PromptDock is an open source workspace that turns rough ideas,
              dictated thoughts, or existing drafts into clearer prompts for AI
              tools.
            </p>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <h3>Can I use the prompts with my own AI platform?</h3>
            <p>
              Yes. Copy a finished prompt into ChatGPT, Claude, Gemini, or
              another AI tool. You can also add a supported provider key to run
              prompts inside PromptDock.
            </p>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <h3>Can I save and share my prompts?</h3>
            <p>
              Yes. Sign in to keep a synced library, then publish individual
              prompts when you want anyone with the link to view and copy them.
            </p>
          </StaggerItem>

          <StaggerItem as="article" kind="rise">
            <h3>Who makes PromptDock?</h3>
            <p>
              PromptDock is an independent, open source project by{" "}
              <a href="https://github.com/kingjethro999">King Jethro</a>. It is
              not affiliated with the AI platforms mentioned here.
            </p>
          </StaggerItem>
        </Stagger>
      </section>
    </>
  );
}

export function LandingFooter() {
  return (
    <>
      <section className="landing-sponsor" aria-labelledby="sponsorHeading">
        <div className="landing-sponsor-copy">
          <span className="landing-kicker">SUPPORT PROMPTDOCK</span>
          <RevealHeading as="h2">
            Help keep better prompts within reach.
          </RevealHeading>
          <Reveal kind="rise" delay={0.1}>
            <p>
              If PromptDock makes your ideas easier to use, you can support the
              person building it. Every contribution helps the project grow.
            </p>
          </Reveal>
        </div>

        <Reveal kind="settle" delay={0.12} className="landing-sponsor-card">
          <Image
            className="sponsor-card-icon"
            src="/assets/brands/github.png"
            width={62}
            height={62}
            alt="GitHub"
          />
          <div className="sponsor-card-body">
            <span className="sponsor-card-eyebrow">BACK THE BUILDER</span>
            <strong>Make room for the next idea.</strong>
            <p>
              Support PromptDock&apos;s ongoing development on GitHub Sponsors.
            </p>
          </div>
          <ActionLink
            external
            className="sponsor-card-link"
            href="https://github.com/sponsors/kingjethro999"
          >
            Sponsor on GitHub <span>↗</span>
          </ActionLink>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-brand">✳ promptdock</span>
        <span className="landing-footer-tagline">
          Ideas deserve a clearer path.
        </span>
        <div className="landing-footer-actions">
          <FeedbackDialog />
          <Link href="/auth?mode=login">Sign in ↗</Link>
        </div>
        <nav
          className="landing-footer-legal"
          aria-label="Legal and community links"
        >
          <a href="https://www.tiktok.com/@thepromptdock">TikTok ↗</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/copyright">Copyright</Link>
        </nav>
      </footer>
    </>
  );
}
