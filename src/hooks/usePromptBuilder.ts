"use client";

import { usePromptBuilderStore } from "@/stores/prompt-builder";
import { buildPrompt } from "@/lib/prompt/format";
import { emptyPromptData } from "@/lib/prompt/types";

export function usePromptBuilder() {
  const idea = usePromptBuilderStore((state) => state.idea);
  const guidance = usePromptBuilderStore((state) => state.guidance);
  const result = usePromptBuilderStore((state) => state.result);
  const pending = usePromptBuilderStore((state) => state.pending);
  const status = usePromptBuilderStore((state) => state.status);
  const busy = usePromptBuilderStore((state) => state.busy);
  const ready = usePromptBuilderStore((state) => state.ready);
  const attachments = usePromptBuilderStore((state) => state.attachments);
  const sourcePrompt = usePromptBuilderStore((state) => state.sourcePrompt);
  const data = result?.data
    ? { ...emptyPromptData, ...result.data, ...guidance }
    : null;
  return {
    idea,
    guidance,
    result,
    pending,
    status,
    busy,
    ready,
    data,
    sourcePrompt,
    prompt: ready && data ? buildPrompt(data) : "",
    attachments,
    setIdea: usePromptBuilderStore((state) => state.setIdea),
    updateGuidance: usePromptBuilderStore((state) => state.updateGuidance),
    editPromptField: usePromptBuilderStore((state) => state.editPromptField),
    addImages: usePromptBuilderStore((state) => state.addImages),
    removeImage: usePromptBuilderStore((state) => state.removeImage),
    answer: usePromptBuilderStore((state) => state.answer),
    generate: usePromptBuilderStore((state) => state.generate),
    finishClarification: usePromptBuilderStore(
      (state) => state.finishClarification,
    ),
    loadPrompt: usePromptBuilderStore((state) => state.loadPrompt),
    savedPrompt: usePromptBuilderStore((state) => state.savedPrompt),
    clear: usePromptBuilderStore((state) => state.clear),
  };
}
