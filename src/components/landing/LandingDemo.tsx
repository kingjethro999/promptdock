"use client";

import { useState } from "react";

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
  const example = examples[selected];
  return (
    <div className="landing-demo" aria-label="Interactive prompt example">
      <div className="landing-demo-top">
        <span className="demo-live-dot" />
        <span>LIVE EXAMPLE</span>
        <span className="demo-step-count">0{selected + 1} / 03</span>
      </div>
      <div className="landing-demo-input">
        <div className="demo-label">YOUR IDEA</div>
        <p>{example.idea}</p>
        <div className="demo-idea-picker" aria-label="Choose example idea">
          {examples.map((item, index) => (
            <button
              className={`demo-choice${selected === index ? " active" : ""}`}
              type="button"
              key={item.name}
              onClick={() => setSelected(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="demo-connector">
        <span aria-hidden="true">✳</span>
        <span>PromptDock shapes the direction</span>
      </div>
      <div className="landing-demo-output">
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
      <button
        className="demo-action"
        type="button"
        onClick={() => setSelected((selected + 1) % examples.length)}
      >
        Shape another idea <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
