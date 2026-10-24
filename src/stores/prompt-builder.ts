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
import { emptyPromptData } from "@/lib/prompt/types";
import {
  completePromptClarification,
  generatePrompt,
} from "./prompt-builder-generation";
import {
  invalidateRequest,
  resetForInput,
  revoke,
} from "./prompt-builder-helpers";

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
  documentRevision: number;
  documentSource: string;
  documentEdited: boolean;
  setIdea(value: string): void;
  setResearchMode(mode: "auto" | "on" | "off"): void;
  setReferenceUrl(url: string): void;
  updateGuidance(field: GuidanceField, value: string): void;
  editPromptField(field: keyof PromptData, value: string): void;
  editDocument(text: string): void;
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
      documentRevision: 0,
      documentSource: "",
      documentEdited: false,
      sourcePrompt: null,

      setIdea(value) {
        set((state) => ({
          ...invalidateRequest(state),
          idea: value,
          status: state.ready
            ? "Source changed. Your previous prompt is kept until a new result succeeds."
            : value.trim()
              ? "Ready to shape your idea"
              : "Add your idea to begin",
        }));
      },
      setResearchMode(mode) {
        set((state) => ({
          ...invalidateRequest(state),
          researchMode: mode,
          pending: state.pending
            ? {
                ...state.pending,
                researchContext: undefined,
                researchSources: undefined,
              }
            : null,
          status:
            "Research settings apply to your next request. Current prompt unchanged.",
        }));
      },
      setReferenceUrl(url) {
        set((state) => ({
          ...invalidateRequest(state),
          referenceUrl: url,
          pending: state.pending
            ? {
                ...state.pending,
                researchContext: undefined,
                researchSources: undefined,
              }
            : null,
          status:
            "Reference URL applies to your next request. Current prompt unchanged.",
        }));
      },
      updateGuidance(field, value) {
        set((state) => ({
          ...invalidateRequest(state),
          guidance: { ...state.guidance, [field]: value },
          status:
            "Options apply to your next request. Current prompt unchanged.",
        }));
      },
      editPromptField(field, value) {
        if (field === "raw") return;
        set((state) => {
          if (!state.result?.data) return {};
          return {
            ...invalidateRequest(state),
            result: {
              ...state.result,
              data: { ...state.result.data, [field]: value },
            },
            documentRevision: state.documentRevision + 1,
            documentEdited: true,
            status: "Prompt updated. Review it before using or saving.",
          };
        });
      },
      editDocument(text) {
        set((state) => {
          if (!state.result?.data || !state.ready) return {};
          return {
            ...invalidateRequest(state),
            result: {
              ...state.result,
              data: { ...emptyPromptData, task: text, raw: true },
            },
            documentRevision: state.documentRevision + 1,
            documentEdited: true,
            status: "Prompt edited. Copy, export and save use this version.",
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
            : invalidateRequest(state)),
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
          ...invalidateRequest(state),
          attachments: state.attachments.filter(
            (_, position) => position !== index,
          ),
        }));
      },
      answer(index, value) {
        set((state) => ({
          ...invalidateRequest(state),
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
          documentSource: saved.idea || saved.data.task,
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
        documentSource: state.documentSource,
        documentEdited: state.documentEdited,
      }),
      merge: (persisted, current) => {
        const draft = persisted as Partial<BuilderState> | undefined;
        return {
          ...current,
          ...draft,
          // Request/document identities are session-local and never restored.
          revision: current.revision,
          documentRevision: current.documentRevision + 1,
          busy: false,
          documentSource:
            draft?.documentSource ?? (draft?.ready ? draft.idea || "" : ""),
          documentEdited: draft?.documentEdited ?? false,
        };
      },
    },
  ),
);
