import type { IconName } from "@/components/ui/Icon";

/**
 * The four states a prompt can be in, as people see them. The data model
 * stores them as `visibility` (private | followers | public) plus the
 * `listedInCommunity` flag, which only applies to public prompts.
 */
export type VisibilityStateId = "private" | "followers" | "link" | "community";

export type VisibilityState = {
  id: VisibilityStateId;
  visibility: "private" | "followers" | "public";
  listed: boolean;
  label: string;
  /** One line shown under the option and as the badge tooltip. */
  hint: string;
  icon: IconName;
};

export const VISIBILITY_STATES: VisibilityState[] = [
  {
    id: "private",
    visibility: "private",
    listed: false,
    label: "Private",
    hint: "Only you can see it. Any link you shared stops working.",
    icon: "lock",
  },
  {
    id: "link",
    visibility: "public",
    listed: false,
    label: "Public link",
    hint: "Anyone with the link can view and copy it. Not shown in Community.",
    icon: "link",
  },
  {
    id: "community",
    visibility: "public",
    listed: true,
    label: "In Community",
    hint: "Public, and listed in Community search, tags and on your profile.",
    icon: "globe",
  },
  {
    id: "followers",
    visibility: "followers",
    listed: false,
    label: "Followers",
    hint: "Only people who follow you can open the link.",
    icon: "users",
  },
];

export function visibilityState(prompt: {
  visibility?: string | null;
  listedInCommunity?: boolean | null;
  publicId?: string | null;
}): VisibilityState {
  const visibility =
    prompt.visibility || (prompt.publicId ? "public" : "private");
  const id: VisibilityStateId =
    visibility === "followers"
      ? "followers"
      : visibility === "public"
        ? prompt.listedInCommunity
          ? "community"
          : "link"
        : "private";
  return VISIBILITY_STATES.find((state) => state.id === id)!;
}
