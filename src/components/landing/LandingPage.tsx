import Link from "next/link";
import { LandingDetails, LandingFooter, LandingProof } from "./LandingDetails";
import LandingDemo from "./LandingDemo";
import ActionLink from "@/components/ui/ActionLink";
import MotionReveal from "@/components/ui/MotionReveal";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-logo" href="/" aria-label="PromptDock home">
          <span className="landing-logo-mark">✳</span> prompt<span>dock</span>
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#your-keys">Your keys</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-signin" href="/auth?mode=login">
            Sign in
          </Link>
          <ActionLink className="landing-small-cta" href="/auth?mode=register">
            Get started <span>↗</span>
          </ActionLink>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          {/* Ambient Living Mesh */}
          <div className="hero-ambient-glow" aria-hidden="true" />

          <MotionReveal
            variant="fade-up"
            delay={60}
            duration={600}
            className="landing-hero-copy"
          >
            {/* Evolution Supporting Tag */}
            <div className="evolution-badge">
              <span className="evolution-badge__pill">
                <span className="evolution-badge__sparkle">✦</span> EVOLUTION
              </span>
              <span>A whole new look. Same workspace.</span>
            </div>

            <div className="landing-eyebrow">
              <span>✳</span> THE IDEA-TO-PROMPT WORKSPACE
            </div>

            <h1>
              Great prompts start with <em>rough ideas.</em>
            </h1>

            <p>
              Say what you mean in your own words. PromptDock reads the intent,
              finds the priorities, and shapes a clear prompt you can take to
              any AI platform.
            </p>

            <div className="landing-hero-actions">
              <ActionLink
                className="landing-primary-cta"
                href="/auth?mode=register"
              >
                Create your workspace <span>↗</span>
              </ActionLink>
              <a className="landing-secondary-cta" href="#how-it-works">
                See how it works <span>↓</span>
              </a>
            </div>

            <div className="landing-hero-note">
              <span className="landing-note-stars">✳ ✳ ✳</span>
              <span>From first thought to useful prompt, in one place.</span>
            </div>
          </MotionReveal>

          <MotionReveal variant="scale-in" delay={180} duration={650}>
            <LandingDemo />
          </MotionReveal>
        </section>

        <MotionReveal variant="fade-in" delay={100} duration={500}>
          <LandingProof />
        </MotionReveal>

        <section className="landing-how" id="how-it-works">
          <MotionReveal
            variant="fade-up"
            duration={550}
            className="landing-section-intro"
          >
            <span className="landing-kicker">HOW IT WORKS</span>
            <h2>
              From “I have an idea”
              <br />
              to “I know what to ask.”
            </h2>
            <p>
              You bring the thought. PromptDock helps turn it into clear
              instructions without asking you to become a prompt engineer.
            </p>
          </MotionReveal>

          <div className="landing-step-grid">
            <MotionReveal
              variant="fade-up"
              delay={80}
              duration={500}
              as="article"
            >
              <span className="landing-step-number">01</span>
              <div className="landing-step-icon">✎</div>
              <h3>Say it naturally</h3>
              <p>
                Type a messy thought or dictate it. A sentence is enough to
                start.
              </p>
            </MotionReveal>

            <MotionReveal
              variant="fade-up"
              delay={180}
              duration={500}
              as="article"
            >
              <span className="landing-step-number">02</span>
              <div className="landing-step-icon">✳</div>
              <h3>See what matters</h3>
              <p>
                AI understands the goal, ranks the focus areas, and flags
                missing details.
              </p>
            </MotionReveal>

            <MotionReveal
              variant="fade-up"
              delay={280}
              duration={500}
              as="article"
            >
              <span className="landing-step-number">03</span>
              <div className="landing-step-icon">↗</div>
              <h3>Make it yours</h3>
              <p>
                Save what works, share it, or copy it into your favorite AI
                tool.
              </p>
            </MotionReveal>
          </div>
        </section>

        <LandingDetails />

        <section className="landing-final">
          <MotionReveal variant="fade-up" duration={550}>
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
          </MotionReveal>
          <MotionReveal variant="scale-in" delay={150} duration={500}>
            <ActionLink
              className="landing-primary-cta"
              href="/auth?mode=register"
            >
              Start with an idea <span>↗</span>
            </ActionLink>
          </MotionReveal>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
