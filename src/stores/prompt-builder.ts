import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { validateAttachments } from "@/lib/client/images";
import type { Attachment } from "@/hooks/useAttachments";
import type {
  Guidance,
  GuidanceField,
  IdeaResult,
  PromptData,
  SavedPrompt,
} from "@/lib/prompt/types";
import type { PromptTemplate } from "@/lib/prompt/templates";
import {
  completePromptClarification,
  generatePrompt,
} from "./prompt-builder-generation";
import { resetForInput, revoke } from "./prompt-builder-helpers";

export type PendingClarification = {
  idea: string;
  guidance: Guidance;
  questions: string[];
  answers: string[];
  imageCount?: number;
  researchContext?: string;
  researchSources?: {
    title?: string;
    url: string;
    publishedAt?: string;
    sourceType?: string;
  }[];
};

export type BuilderState = {
  idea: string;
  guidance: Guidance;
  researchMode: "auto" | "on" | "off";
  referenceUrl: string;
  result: IdeaResult | null;
  pending: PendingClarification | null;
  status: string;
  busy: boolean;
  ready: boolean;
  attachments: Attachment[];
  sourcePrompt: SavedPrompt | null;
  revision: number;
  setIdea(value: string): void;
  setResearchMode(mode: "auto" | "on" | "off"): void;
  setReferenceUrl(url: string): void;
  updateGuidance(field: GuidanceField, value: string): void;
  editPromptField(field: keyof PromptData, value: string): void;
  addImages(files: File[]): void;
  removeImage(index: number): void;
  answer(index: number, value: string): void;
  generate(): Promise<void>;
  finishClarification(skip?: boolean): Promise<void>;
  loadPrompt(saved: SavedPrompt): void;
  loadTemplate(template: PromptTemplate): void;
  savedPrompt(saved: SavedPrompt): void;
  clear(): void;
};

export const usePromptBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      idea: "",
      guidance: {},
      researchMode: "auto",
      referenceUrl: "",
      result: null,
      pending: null,
      status: "Add your idea to begin",
      busy: false,
      ready: false,
      attachments: [],
      revision: 0,
      sourcePrompt: null,

      setIdea(value) {
        set((state) => ({
          ...resetForInput(state),
          idea: value,
          status: value.trim()
            ? "Ready to shape your idea"
            : "Add your idea to begin",
        }));
      },
      setResearchMode(mode) {
        set({ researchMode: mode });
      },
      setReferenceUrl(url) {
        set({ referenceUrl: url });
      },
      updateGuidance(field, value) {
        set((state) => ({
          guidance: { ...state.guidance, [field]: value },
          pending: null,
          revision: state.revision + 1,
          status: state.ready
            ? "Prompt updated. Review it before using or saving."
            : state.status,
        }));
      },
      editPromptField(field, value) {
        if (field === "raw") return;
        set((state) => {
          if (!state.result?.data) return {};
          const guidance = { ...state.guidance };
          delete guidance[field as GuidanceField];
          return {
            guidance,
            result: {
              ...state.result,
              data: { ...state.result.data, [field]: value },
            },
            revision: state.revision + 1,
            status: "Prompt updated. Review it before using or saving.",
          };
        });
      },
      addImages(files) {
        const current = get().attachments;
        validateAttachments([...current.map(({ file }) => file), ...files]);
        const added = files.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        }));
        set((state) => ({
          ...(state.pending?.imageCount &&
          state.attachments.length < state.pending.imageCount
            ? {}
            : resetForInput(state)),
          attachments: [...state.attachments, ...added],
          status: state.pending?.imageCount
            ? "Images attached. Answer the quick check to finish."
            : "Images attached. Ready to shape your idea.",
        }));
      },
      removeImage(index) {
        const current = get().attachments;
        if (!current[index]) return;
        revoke([current[index]]);
        set((state) => ({
          ...resetForInput(state),
          attachments: state.attachments.filter(
            (_, position) => position !== index,
          ),
        }));
      },
      answer(index, value) {
        set((state) => ({
          pending: state.pending
            ? {
                ...state.pending,
                answers: state.pending.answers.map((answer, position) =>
                  position === index ? value : answer,
                ),
              }
            : null,
        }));
      },
      async generate() {
        await generatePrompt(get, set);
      },
      async finishClarification(skip = false) {
        await completePromptClarification(get, set, skip);
      },
      loadPrompt(saved) {
        revoke(get().attachments);
        set((state) => ({
          ...resetForInput(state),
          idea: saved.idea || saved.data.task,
          guidance: {},
          result: { provider: "library", data: saved.data },
          ready: true,
          attachments: [],
          sourcePrompt: saved,
          status: "Saved prompt opened.",
        }));
      },
      loadTemplate(template) {
        revoke(get().attachments);
        set((state) => ({
          ...resetForInput(state),
          idea: template.idea,
          guidance: template.guidance,
          attachments: [],
          sourcePrompt: null,
          status: `${template.name} template loaded. Shape it when ready.`,
        }));
      },
      savedPrompt(saved) {
        set({ sourcePrompt: saved });
      },
      clear() {
        revoke(get().attachments);
        set((state) => ({
          ...resetForInput(state),
          idea: "",
          guidance: {},
          researchMode: "auto",
          referenceUrl: "",
          attachments: [],
          sourcePrompt: null,
          status: "Add your idea to begin",
        }));
      },
    }),
    {
      name: "promptdock.react-draft.v1",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        idea: state.idea,
        guidance: state.guidance,
        researchMode: state.researchMode,
        referenceUrl: state.referenceUrl,
        result: state.result,
        pending: state.pending,
        ready: state.ready,
        sourcePrompt: state.sourcePrompt,
      }),
    },
  ),
);
