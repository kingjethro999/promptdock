import type { Attachment } from "@/hooks/useAttachments";
import type { BuilderState } from "./prompt-builder";

export function invalidateRequest(state: BuilderState) {
  return {
    revision: state.revision + 1,
    pending: null,
    busy: false,
  };
}

export function resetForInput(state: BuilderState) {
  return {
    ...invalidateRequest(state),
    result: null,
    ready: false,
    documentRevision: state.documentRevision + 1,
    documentSource: "",
    documentEdited: false,
  };
}

export function revoke(attachments: Attachment[]) {
  if (typeof URL === "undefined" || !URL.revokeObjectURL) return;
  attachments.forEach(({ preview }) => URL.revokeObjectURL(preview));
}
