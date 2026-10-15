export const BANNER_PRESETS = [
  { id: "moss", label: "Moss", color: "#2f5c3f" },
  { id: "sage", label: "Sage", color: "#5c7865" },
  { id: "sand", label: "Sand", color: "#9e8e78" },
  { id: "clay", label: "Clay", color: "#8f5e46" },
  { id: "slate", label: "Slate", color: "#4f6367" },
  { id: "ink", label: "Ink", color: "#202d28" },
] as const;

export type PresetId = (typeof BANNER_PRESETS)[number]["id"];
export const PRESET_IDS = new Set<string>(BANNER_PRESETS.map((p) => p.id));
