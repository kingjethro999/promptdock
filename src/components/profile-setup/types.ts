import type { PresetId } from "@/lib/profile/banner-presets";
import type { Generated } from "@/lib/profile/avatar-gen";

export const STEPS = [
  {
    id: "name",
    region: "name",
    heading: "What should we call you?",
    helper:
      "This is the name on your profile in Community. It starts as your username, so you can keep it.",
  },
  {
    id: "photo",
    region: "avatar",
    heading: "Add a photo",
    helper: "Upload one, or choose an avatar. A letter works too.",
  },
  {
    id: "banner",
    region: "banner",
    heading: "Pick a cover",
    helper: "A color works. So does a picture.",
  },
  {
    id: "bio",
    region: "bio",
    heading: "Say a little about yourself",
    helper: "One or two lines on what you build or care about.",
  },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type Region = (typeof STEPS)[number]["region"];

export type Img = { id: string; blob: Blob; previewUrl: string };

export type Draft = {
  displayName: string;
  avatar:
    | { kind: "none" }
    | ({ kind: "image"; source: "upload" | "provider" } & Img)
    | ({ kind: "generated"; id: string } & Generated);
  banner:
    | { kind: "none" }
    | { kind: "preset"; id: PresetId }
    | ({ kind: "image" } & Img);
  bio: string;
};

export const changed = (step: StepId, d: Draft, i: Draft) => {
  if (step === "photo") {
    return d.avatar.kind !== "none" && d.avatar !== i.avatar;
  }
  if (step === "banner") {
    return d.banner.kind !== "none" && d.banner !== i.banner;
  }
  if (step === "bio") {
    return d.bio.trim() !== i.bio.trim();
  }
  return true;
};
