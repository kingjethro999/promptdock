"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const storySteps = [
  {
    kicker: "PHASE 01 — CAPTURE",
    title: "Say what you mean without prompt anxiety.",
    description:
      "Speak a messy thought or paste a quick note. PromptDock never forces you to format before you think.",
    surfaceState: {
      tag: "RAW INTENT",
      content:
        "“I want to launch a skincare line, but I don't know suppliers or budgeting.”",
      meta: "Dictated or typed in seconds",
    },
  },
  {
    kicker: "PHASE 02 — DISTILL",
    title: "Priorities emerge automatically.",
    description:
      "The workspace identifies the underlying goal, extracts constraints, and ranks focus areas so AI models spend effort where it counts.",
    surfaceState: {
      tag: "ANALYZED FOCUS",
      content:
        "Goal: Low-risk launch plan | Focus: Validation → Costing → First 100 customers",
      meta: "3 priority branches mapped",
    },
  },
  {
    kicker: "PHASE 03 — DEPLOY",
    title: "Take it to Claude, ChatGPT, or your own model.",
    description:
      "One click exports a structured prompt ready for any AI tool, or runs it directly with your own provider key.",
    surfaceState: {
      tag: "STRUCTURED PROMPT",
      content:
        "System: Direct execution | Depth: Deep | Target: Claude 3.7 / GPT-4o",
      meta: "100% portable workspace prompt",
    },
  },
];

export default function SignatureSequence() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(
        {
          pinned: "(min-width: 900px) and (min-height: 600px)",
          lite: "(max-width: 899px), (max-height: 599px)", // tablet portrait, phones, landscape phones
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { pinned, reduce } = ctx.conditions as {
            pinned: boolean;
            lite: boolean;
            reduce: boolean;
          };
          if (reduce) return; // add nothing: CSS renders the stacked, fully legible layout

          const surface = el.querySelector<HTMLElement>("[data-surface]");
          const captions = gsap.utils.toArray<HTMLElement>(
            "[data-caption]",
            el,
          );

          if (!surface || captions.length === 0) return;

          if (pinned) {
            gsap.set(surface, { transformPerspective: 1200 });
            gsap.set(captions.slice(1), { autoAlpha: 0, y: 16 });

            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: el,
                start: "top top",
                end: () => `+=${(captions.length - 1) * 90}%`,
                pin: true,
                scrub: 0.6,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            captions.forEach((cap, i) => {
              if (i === 0) return;
              tl.to(
                surface,
                { rotateY: -6 * i, z: 30 * i, duration: 1, ease: "power1.inOut" },
                i - 1,
              )
                .to(
                  captions[i - 1],
                  { autoAlpha: 0, y: -16, duration: 0.3, ease: "power2.in" },
                  i - 1 + 0.7,
                )
                .to(
                  cap,
                  { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" },
                  i - 1 + 0.85,
                );
            });
          } else {
            // lite: no pin, no scrub. One quiet reveal per caption, fires once even if user jumps past it.
            captions.forEach((c) => {
              gsap.set(c, { autoAlpha: 0, y: 12 });
              ScrollTrigger.create({
                trigger: c,
                start: "top 85%",
                once: true,
                onEnter: () =>
                  gsap.to(c, {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.45,
                    ease: "power3.out",
                  }),
              });
            });
          }
        },
      );

      document.fonts?.ready.then(() => ScrollTrigger.refresh());
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="sequence">
      <div className="sequence__inner">
        <div className="sequence__content">
          <div className="sequence__captions">
            {storySteps.map((step, idx) => (
              <div
                key={idx}
                data-caption
                className={`sequence__caption sequence__caption--${idx}`}
              >
                <span className="sequence__kicker">{step.kicker}</span>
                <h3 className="sequence__title">{step.title}</h3>
                <p className="sequence__description">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sequence__stage">
          <div data-surface className="sequence__surface">
            <div className="sequence__surface-head">
              <span className="sequence__surface-dot" />
              <span>THE WORKSPACE IN MOTION</span>
              <span className="sequence__surface-badge">PROMPTDOCK ARCHITECTURE</span>
            </div>
            <div className="sequence__surface-body">
              <div className="sequence__surface-pill">✦ DYNAMIC SYNTHESIS</div>
              <div className="sequence__surface-content">
                <strong>“Turn rough thoughts into crystal-clear prompts.”</strong>
                <p>
                  Zero friction capture → structural prioritization → platform-agnostic output.
                </p>
              </div>
              <div className="sequence__surface-foot">
                <span>✳ PromptDock Engine</span>
                <small>Same workspace. Living clarity.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
