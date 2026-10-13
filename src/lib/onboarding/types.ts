export type Placement = "top" | "bottom" | "left" | "right" | "auto";
export type PrepareName = "open-sidebar";

export type Step = {
  id: string;
  kind: "modal" | "spotlight";
  title: string;
  body: string;
  target?: string;
  placement?: Placement;
  media?: "wireframe-composer" | "wireframe-community" | null;
  prepare?: PrepareName;
  cta?: { label: string; href?: string; focus?: string };
  compact?: Partial<Pick<Step, "kind" | "target" | "body" | "prepare">>;
};

export type Experience = {
  id: string;
  type: "welcome" | "release";
  priority: number;
  publishedAt: string;
  title: string;
  summary: string;
  audience?: { createdAfter?: string; createdBefore?: string };
  routes?: string[];
  steps: Step[];
};

export type ClientExperience = Experience;
