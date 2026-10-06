export type PromptData = {
  task: string;
  role: string;
  audience: string;
  context: string;
  format: string;
  tone: string;
  approach: string;
  focus: string;
  depth: string;
  constraints: string;
  raw?: boolean;
};

export type PromptInterpretation = {
  goal: string;
  whyThisDepth: string;
  focusAreas: string[];
  missingDetails: string[];
};

export type Clarification = { question: string; answer: string };

export type IdeaResult = {
  provider: string;
  questions?: string[];
  data?: PromptData;
  interpretation?: PromptInterpretation;
};

export type SavedPrompt = {
  id: string;
  name: string;
  data: PromptData;
  idea: string;
  analysis: PromptInterpretation | null;
  tags: string[];
  updatedAt: string;
  publicId?: string | null;
  forkedFrom?: string | null;
};

export const emptyPromptData: PromptData = {
  task: "",
  role: "",
  audience: "",
  context: "",
  format: "",
  tone: "",
  approach: "",
  focus: "",
  depth: "",
  constraints: "",
};

export const guidanceFields = [
  "role",
  "audience",
  "context",
  "format",
  "tone",
  "approach",
  "focus",
  "depth",
  "constraints",
] as const;

export type GuidanceField = (typeof guidanceFields)[number];
export type Guidance = Partial<Pick<PromptData, GuidanceField>>;
