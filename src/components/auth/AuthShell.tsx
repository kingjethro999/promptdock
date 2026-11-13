import Link from "next/link";
import { Glyph } from "@/components/ui";

/** The two-panel frame shared by every account page. */
export default function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page-body">
      <main className="auth-page">
        <section className="auth-story" aria-label="About PromptDock">
          <Link className="auth-brand" href="/" aria-label="PromptDock home">
            <span className="auth-brand-mark">
              <Glyph name="spark" size={16} />
            </span>
            <span>
              prompt<span>dock</span>
              <small>YOUR AI WORKSPACE</small>
            </span>
          </Link>
          <div className="auth-story-copy">
            <span className="landing-kicker">
              YOUR IDEAS, WITH A CLEARER PATH
            </span>
            <h1>Turn a rough thought into a prompt worth keeping.</h1>
            <p>
              Save what works, return from any device, and share your best
              prompts with your people.
            </p>
          </div>
          <div className="auth-story-note">
            <span>
              <Glyph name="star" size={14} />
            </span>{" "}
            Start free. Bring your own model keys when you are ready.
          </div>
        </section>
        <section className="auth-panel" aria-labelledby="authTitle">
          <Link className="auth-back" href="/">
            <Glyph
              name="arrow-right"
              size={14}
              style={{ transform: "rotate(180deg)", display: "inline-block" }}
            />{" "}
            Back to PromptDock
          </Link>
          <div className="auth-card">
            <span className="auth-card-mark" aria-hidden="true">
              <Glyph name="spark" size={20} />
            </span>
            <h1 id="authTitle">{title}</h1>
            <p>{lead}</p>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
