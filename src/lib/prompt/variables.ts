const promptVariables = require("../../prompt-variables") as {
  VARIABLE_PATTERN: RegExp;
  extractPromptVariables(text: string): string[];
  interpolatePrompt(text: string, values: Record<string, string>): string;
};

export const VARIABLE_PATTERN = promptVariables.VARIABLE_PATTERN;
export const extractPromptVariables = promptVariables.extractPromptVariables;
export const interpolatePrompt = promptVariables.interpolatePrompt;
