const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPrompt,
  buildPromptWithProfile,
  buildUniversalPrompt,
  buildClaudePrompt,
  buildOpenAIPrompt,
  buildReasoningPrompt,
  buildCursorRulesPrompt,
  PROMPT_PROFILES,
} = require("../src/prompt-format");

const sampleData = {
  task: "Build a responsive dashboard using Next.js App Router",
  role: "Senior Full-Stack Engineer",
  audience: "Enterprise team leads",
  context: "Existing project uses PostgreSQL and Next.js 16 with TypeScript.",
  format: "Code with explanation",
  tone: "Professional",
  approach: "Define types, create database adapter, build UI components",
  focus: "Type safety and zero runtime hydration errors",
  depth: "Deep",
  constraints: "Strict TypeScript without any types. Use server components where possible.",
};

test("PROMPT_PROFILES defines supported platforms", () => {
  const ids = PROMPT_PROFILES.map((p) => p.id);
  assert.deepEqual(ids, ["universal", "claude", "openai", "reasoning", "cursor"]);
});

test("buildUniversalPrompt produces standard prompt layout", () => {
  const output = buildUniversalPrompt(sampleData);
  assert.match(output, /^Act as Senior Full-Stack Engineer\./);
  assert.match(output, /Task: Build a responsive dashboard/);
  assert.match(output, /Context:\nExisting project/);
  assert.match(output, /Output format: Code with explanation/);
});

test("buildClaudePrompt structures prompt using Claude XML tags", () => {
  const output = buildClaudePrompt(sampleData);
  assert.match(output, /<role>\nAct as Senior Full-Stack Engineer\.\n<\/role>/);
  assert.match(output, /<task>\nBuild a responsive dashboard using Next\.js App Router\n<\/task>/);
  assert.match(output, /<context>\nExisting project uses PostgreSQL/);
  assert.match(output, /<instructions>/);
  assert.match(output, /Format: Code with explanation/);
  assert.match(output, /<constraints>\nStrict TypeScript/);
});

test("buildOpenAIPrompt structures prompt with markdown developer directives", () => {
  const output = buildOpenAIPrompt(sampleData);
  assert.match(output, /# Role & Persona\nAct as Senior Full-Stack Engineer\./);
  assert.match(output, /# Objective\nBuild a responsive dashboard/);
  assert.match(output, /## Context\nExisting project/);
  assert.match(output, /## Execution Guidelines/);
  assert.match(output, /- \*\*Output Format\*\*: Code with explanation/);
  assert.match(output, /## Constraints & Requirements\nStrict TypeScript/);
});

test("buildReasoningPrompt optimizes for step-by-step reasoning models", () => {
  const output = buildReasoningPrompt(sampleData);
  assert.match(output, /^Build a responsive dashboard/);
  assert.match(output, /Perspective: Act as Senior Full-Stack Engineer/);
  assert.match(output, /Analyze this request step-by-step/);
  assert.match(output, /Priorities to verify:\nType safety/);
});

test("buildCursorRulesPrompt formats prompt as IDE rule definition", () => {
  const output = buildCursorRulesPrompt(sampleData);
  assert.match(output, /# You are an expert AI assistant specialized as Senior Full-Stack Engineer\./);
  assert.match(output, /## Purpose\nBuild a responsive dashboard/);
  assert.match(output, /## Architecture & Context\nExisting project/);
  assert.match(output, /## Rules & Invariants/);
  assert.match(output, /- \*\*Quality Standards\*\*: Type safety/);
});

test("buildPromptWithProfile switches dynamically across profiles", () => {
  assert.equal(
    buildPromptWithProfile(sampleData, "universal"),
    buildPrompt(sampleData),
  );
  assert.match(buildPromptWithProfile(sampleData, "claude"), /<task>/);
  assert.match(buildPromptWithProfile(sampleData, "openai"), /# Objective/);
  assert.match(buildPromptWithProfile(sampleData, "cursor"), /## Architecture & Context/);
  assert.match(buildPromptWithProfile(sampleData, "reasoning"), /Analyze this request step-by-step/);
});
