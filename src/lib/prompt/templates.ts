import type { Guidance } from "./types";

export type PromptTemplate = {
  id: string;
  icon: string;
  name: string;
  idea: string;
  guidance: Guidance;
};

export const promptTemplates: PromptTemplate[] = [
  {
    id: "writing",
    icon: "✎",
    name: "Write anything",
    idea: "Write a compelling piece about [topic]",
    guidance: {
      role: "An experienced writer",
      audience: "[target audience]",
      context:
        "The key idea is [main idea]. The reader should come away knowing [takeaway].",
      format: "Article",
      tone: "Clear and concise",
      constraints: "Use specific examples. Avoid filler and jargon.",
    },
  },
  {
    id: "research",
    icon: "⌕",
    name: "Research a topic",
    idea: "Research [topic] and summarize the most useful findings",
    guidance: {
      role: "A careful research analyst",
      audience: "A curious non-expert",
      context: "I need this research to help me decide [decision or goal].",
      format: "Bulleted list",
      tone: "Educational",
      constraints:
        "Separate established facts from uncertainty. Cite sources when available and say when you cannot verify a claim.",
    },
  },
  {
    id: "code",
    icon: "⌘",
    name: "Explain code",
    idea: "Explain how this code works and suggest improvements",
    guidance: {
      role: "A patient senior software engineer",
      audience: "A developer learning this codebase",
      context:
        "Language and framework: [add details]. Code: [paste code here].",
      format: "Code with explanation",
      tone: "Educational",
      constraints:
        "Explain the main flow first. Flag correctness and security issues. Show improved code only where useful.",
    },
  },
  {
    id: "brainstorm",
    icon: "✳",
    name: "Brainstorm ideas",
    idea: "Generate fresh ideas for [project or problem]",
    guidance: {
      role: "A creative strategist",
      audience: "[who the ideas are for]",
      context: "Goal: [desired result]. Resources and limitations: [details].",
      format: "Bulleted list",
      tone: "Creative",
      constraints:
        "Include practical and unexpected ideas. Give each idea a short explanation and one first step.",
    },
  },
  {
    id: "summarize",
    icon: "▤",
    name: "Summarize content",
    idea: "Summarize the following content: [paste content]",
    guidance: {
      role: "A clear and precise editor",
      audience: "Someone who needs the key points quickly",
      context: "The most important question I need answered is [question].",
      format: "Bulleted list",
      tone: "Clear and concise",
      constraints:
        "Preserve the original meaning. Highlight key decisions, numbers, and open questions. Do not invent details.",
    },
  },
];
