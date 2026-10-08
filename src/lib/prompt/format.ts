import type { PromptData } from "./types";

const promptFormat = require("../../prompt-format") as {
  PROMPT_PROFILES: {
    id: PromptProfile;
    label: string;
    extension: string;
    badge: string;
  }[];
  buildUniversalPrompt(data: PromptData): string;
  buildClaudePrompt(data: PromptData): string;
  buildOpenAIPrompt(data: PromptData): string;
  buildReasoningPrompt(data: PromptData): string;
  buildCursorRulesPrompt(data: PromptData): string;
  buildPromptWithProfile(data: PromptData, profile?: PromptProfile): string;
  buildPrompt(data: PromptData): string;
};

export type PromptProfile =
  "universal" | "claude" | "openai" | "reasoning" | "cursor";

export const PROMPT_PROFILES = promptFormat.PROMPT_PROFILES;
export const buildUniversalPrompt = promptFormat.buildUniversalPrompt;
export const buildClaudePrompt = promptFormat.buildClaudePrompt;
export const buildOpenAIPrompt = promptFormat.buildOpenAIPrompt;
export const buildReasoningPrompt = promptFormat.buildReasoningPrompt;
export const buildCursorRulesPrompt = promptFormat.buildCursorRulesPrompt;
export const buildPromptWithProfile = promptFormat.buildPromptWithProfile;
export const buildPrompt = promptFormat.buildPrompt;
