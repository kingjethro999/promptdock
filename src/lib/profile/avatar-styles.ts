export const AVATAR_STYLES = [
  {
    id: "lorelei",
    label: "Portrait",
    license: "CC0-1.0",
    source: "https://www.dicebear.com/styles/lorelei/",
  },
  {
    id: "notionists",
    label: "Sketch",
    license: "CC0-1.0",
    source: "https://www.dicebear.com/styles/notionists/",
  },
  {
    id: "shapes",
    label: "Abstract",
    license: "CC0-1.0",
    source: "https://www.dicebear.com/styles/shapes/",
  },
] as const;

export type StyleId = (typeof AVATAR_STYLES)[number]["id"];
export const DEFAULT_STYLE: StyleId = "lorelei";
