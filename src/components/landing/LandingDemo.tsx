"use client";

import { useState } from "react";
import { InteractiveSurface } from "@/components/motion/InteractiveSurface";
import LiquidButton from "@/components/ui/LiquidButton";

const examples = [
  {
    name: "Start a business",
    idea: "I want to launch a small skincare brand, but I don't know where to begin.",
    goal: "Build a practical launch plan for a handmade skincare business.",
    focus: "First steps → product validation → realistic launch costs.",
    format: "Step-by-step plan with open questions.",
    depth: "Deep",
  },
  {
    name: "Plan an app",
    idea: "I have an app idea for helping people plan meals from what is already in their fridge.",
    goal: "Plan a useful first version of a meal-planning app.",
    focus: "Core user need → smallest useful feature set → launch risks.",
    format: "Product outline and prioritized next steps.",
    depth: "Deep",
  },
  {
    name: "Study better",
    idea: "I need a better way to study for a big exam next month.",
    goal: "Create a realistic study plan for the next four weeks.",
    focus: "Time available → active recall → weekly check-ins.",
    format: "Weekly schedule with daily actions.",
    depth: "Balanced",
  },
];

export default function LandingDemo() {
  const [selected, setSelected] = useState(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const example = examples[selected];

  const triggerSynthesis = (nextIndex: number) => {
    if (isSynthesizing) return;
    setIsSynthesizing(true);
    setTimeout(() => {
      setSelected(nextIndex);
      setIsSynthesizing(false);
    }, 750);
  };

  return (
    <div className="landing-demo-wrapper">
      <InteractiveSurface max={5}>
        <div
          className={`landing-demo ${isSynthesizing ? "is-synthesizing" : ""}`}
          aria-label="Interactive prompt workspace preview"
        >
          <div className="landing-demo-top">
            <span className="demo-live-dot" />
            <span>LIVE WORKSPACE PREVIEW</span>
            <span className="demo-step-count">0{selected + 1} / 03</span>
          </div>

          <div className="landing-demo-input">
            <div className="demo-label">ROUGH IDEA</div>
            <p>{example.idea}</p>
            <div className="demo-idea-picker" aria-label="Choose example idea">
              {examples.map((item, index) => (
                <button
                  className={`demo-choice${selected === index ? " active" : ""}`}
                  type="button"
                  key={item.name}
                  onClick={() => triggerSynthesis(index)}
                  disabled={isSynthesizing}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="demo-connector">
            <div className="demo-connector__indicator">
              <span className="demo-connector__asterisk" aria-hidden="true">
                ✳
              </span>
              <span>
                {isSynthesizing
                  ? "Distilling intent & priorities…"
                  : "PromptDock shapes the direction"}
              </span>
            </div>
            <span className="demo-connector__badge">Auto-format</span>
          </div>

          <div
            className={`landing-demo-output ${
              isSynthesizing ? "is-synthesizing fluid-shimmer" : ""
            }`}
          >
            <div className="demo-output-head">
              <span>✦ STRUCTURED PROMPT</span>
              <span>{example.depth}</span>
            </div>
            <div className="demo-output-row">
              <span>GOAL</span>
              <strong>{example.goal}</strong>
            </div>
            <div className="demo-output-row">
              <span>FOCUS</span>
              <strong>{example.focus}</strong>
            </div>
            <div className="demo-output-row">
              <span>FORMAT</span>
              <strong>{example.format}</strong>
            </div>
          </div>

          <div className="demo-action-container">
            <LiquidButton
              variant="accent"
              size="md"
              loading={isSynthesizing}
              loadingText="Shaping structured prompt…"
              icon={<span>↗</span>}
              onClick={() => triggerSynthesis((selected + 1) % examples.length)}
            >
              Shape another idea
            </LiquidButton>
          </div>
        </div>
      </InteractiveSurface>
    </div>
  );
}
