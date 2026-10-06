import type { Attachment } from "@/hooks/useAttachments";
import type { BuilderState } from "./prompt-builder";

export function resetForInput(state: BuilderState) {
  return {
    revision: state.revision + 1,
    result: null,
    pending: null,
    ready: false,
  };
}

export function revoke(attachments: Attachment[]) {
  if (typeof URL === "undefined" || !URL.revokeObjectURL) return;
  attachments.forEach(({ preview }) => URL.revokeObjectURL(preview));
}
