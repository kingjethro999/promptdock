const PROMPT_PROFILES = [
  { id: "universal", label: "Universal", extension: ".md", badge: "Standard" },
  { id: "claude", label: "Claude (XML)", extension: ".md", badge: "Anthropic" },
  { id: "openai", label: "OpenAI", extension: ".md", badge: "Structured" },
  {
    id: "reasoning",
    label: "Reasoning",
    extension: ".md",
    badge: "o-series / R1",
  },
  {
    id: "cursor",
    label: ".cursorrules",
    extension: ".cursorrules",
    badge: "IDE Rule",
  },
];

const depthCopy = {
  Quick: "Keep the answer brief and give the essential result or next step.",
  Balanced: "Give a clear, practical answer with enough detail to act.",
  Deep: "Work through the important reasoning, tradeoffs, edge cases, and concrete next steps.",
};

function buildUniversalPrompt(data = {}) {
  if (!data.task?.trim()) return "";
  const details = [
    "role",
    "context",
    "audience",
    "approach",
    "format",
    "tone",
    "focus",
    "depth",
    "constraints",
  ];
  if (data.raw && details.every((field) => !data[field])) return data.task;
  const parts = [];
  if (data.role) parts.push(`Act as ${data.role.replace(/[.\s]+$/, "")}.`);
  parts.push(`Task: ${data.task}`);
  if (data.context) parts.push(`Context:\n${data.context}`);
  if (data.audience) parts.push(`Audience: ${data.audience}`);
  if (data.approach) parts.push(`Suggested approach:\n${data.approach}`);
  if (data.format) parts.push(`Output format: ${data.format}`);
  if (data.tone) parts.push(`Tone: ${data.tone}`);
  if (data.focus)
    parts.push(
      `Priorities (spend the most attention on the first):\n${data.focus}`,
    );
  if (depthCopy[data.depth])
    parts.push(`Answer depth: ${data.depth}. ${depthCopy[data.depth]}`);
  if (data.constraints) parts.push(`Requirements:\n${data.constraints}`);
  return parts.join("\n\n");
}

function buildClaudePrompt(data = {}) {
  if (!data.task?.trim()) return "";
  const parts = [];
  if (data.role) {
    parts.push(`<role>\nAct as ${data.role.replace(/[.\s]+$/, "")}.\n</role>`);
  }
  parts.push(`<task>\n${data.task}\n</task>`);
  if (data.context) {
    parts.push(`<context>\n${data.context}\n</context>`);
  }
  const instructions = [];
  if (data.audience) instructions.push(`Audience: ${data.audience}`);
  if (data.approach) instructions.push(`Approach: ${data.approach}`);
  if (data.format) instructions.push(`Format: ${data.format}`);
  if (data.tone) instructions.push(`Tone: ${data.tone}`);
  if (data.focus) instructions.push(`Priorities:\n${data.focus}`);
  if (depthCopy[data.depth]) {
    instructions.push(`Depth: ${data.depth}. ${depthCopy[data.depth]}`);
  }
  if (instructions.length) {
    parts.push(`<instructions>\n${instructions.join("\n\n")}\n</instructions>`);
  }
  if (data.constraints) {
    parts.push(`<constraints>\n${data.constraints}\n</constraints>`);
  }
  return parts.join("\n\n");
}

function buildOpenAIPrompt(data = {}) {
  if (!data.task?.trim()) return "";
  const parts = [];
  if (data.role) {
    parts.push(`# Role & Persona\nAct as ${data.role.replace(/[.\s]+$/, "")}.`);
  }
  parts.push(`# Objective\n${data.task}`);
  if (data.context) {
    parts.push(`## Context\n${data.context}`);
  }
  const guidelines = [];
  if (data.audience) guidelines.push(`- **Audience**: ${data.audience}`);
  if (data.approach) guidelines.push(`- **Suggested Flow**: ${data.approach}`);
  if (data.format) guidelines.push(`- **Output Format**: ${data.format}`);
  if (data.tone) guidelines.push(`- **Tone**: ${data.tone}`);
  if (data.focus) guidelines.push(`- **Key Focus**: ${data.focus}`);
  if (depthCopy[data.depth]) {
    guidelines.push(`- **Depth**: ${data.depth} (${depthCopy[data.depth]})`);
  }
  if (guidelines.length) {
    parts.push(`## Execution Guidelines\n${guidelines.join("\n")}`);
  }
  if (data.constraints) {
    parts.push(`## Constraints & Requirements\n${data.constraints}`);
  }
  return parts.join("\n\n");
}

function buildReasoningPrompt(data = {}) {
  if (!data.task?.trim()) return "";
  const parts = [];
  parts.push(data.task);
  if (data.role) {
    parts.push(`Perspective: Act as ${data.role.replace(/[.\s]+$/, "")}.`);
  }
  if (data.context) {
    parts.push(`Context & Background:\n${data.context}`);
  }
  const directives = [];
  directives.push(
    "Analyze this request step-by-step. Work through tradeoffs and verify edge cases before concluding.",
  );
  if (data.focus) directives.push(`Priorities to verify:\n${data.focus}`);
  if (data.constraints)
    directives.push(`Constraints to satisfy:\n${data.constraints}`);
  if (data.format) directives.push(`Deliverable format: ${data.format}`);
  parts.push(directives.join("\n\n"));
  return parts.join("\n\n");
}

function buildCursorRulesPrompt(data = {}) {
  if (!data.task?.trim()) return "";
  const roleText = data.role
    ? ` specialized as ${data.role.replace(/[.\s]+$/, "")}`
    : "";
  const parts = [
    `# You are an expert AI assistant${roleText}.`,
    `## Purpose\n${data.task}`,
  ];
  if (data.context) {
    parts.push(`## Architecture & Context\n${data.context}`);
  }
  const rules = [];
  if (data.approach) rules.push(`- **Implementation Flow**: ${data.approach}`);
  if (data.focus) rules.push(`- **Quality Standards**: ${data.focus}`);
  if (data.format) rules.push(`- **Response Format**: ${data.format}`);
  if (data.constraints)
    rules.push(`- **Invariants & Constraints**: ${data.constraints}`);
  if (rules.length) {
    parts.push(`## Rules & Invariants\n${rules.join("\n")}`);
  }
  return parts.join("\n\n");
}

function buildPromptWithProfile(data = {}, profile = "universal") {
  switch (profile) {
    case "claude":
      return buildClaudePrompt(data);
    case "openai":
      return buildOpenAIPrompt(data);
    case "reasoning":
      return buildReasoningPrompt(data);
    case "cursor":
      return buildCursorRulesPrompt(data);
    case "universal":
    default:
      return buildUniversalPrompt(data);
  }
}

function buildPrompt(data = {}) {
  return buildUniversalPrompt(data);
}

module.exports = {
  PROMPT_PROFILES,
  buildPrompt,
  buildPromptWithProfile,
  buildUniversalPrompt,
  buildClaudePrompt,
  buildOpenAIPrompt,
  buildReasoningPrompt,
  buildCursorRulesPrompt,
};
