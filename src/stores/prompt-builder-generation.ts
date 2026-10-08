import type { StoreApi } from "zustand";
import { api } from "@/lib/client/api";
import { ideaPayload } from "@/lib/client/images";
import type { Guidance, IdeaResult } from "@/lib/prompt/types";
import type { BuilderState } from "./prompt-builder";

type GetState = StoreApi<BuilderState>["getState"];
type SetState = StoreApi<BuilderState>["setState"];
const imageOnlyIdea =
  "Turn the attached image into a detailed, reusable prompt.";

async function requestPrompt(
  idea: string,
  guidance: Guidance,
  files: File[],
  clarifications?: { question: string; answer: string }[],
  research?: {
    context?: string;
    sources?: {
      title?: string;
      url: string;
      description?: string;
      publishedAt?: string;
      sourceType?: string;
    }[];
  },
  options?: {
    researchMode?: "auto" | "on" | "off";
    referenceUrls?: string[];
  },
) {
  const body = JSON.parse(
    await ideaPayload(
      idea,
      guidance as Record<string, string>,
      files,
      clarifications,
    ),
  );
  if (research?.context) body.researchContext = research.context;
  if (research?.sources?.length) body.researchSources = research.sources;
  if (options?.researchMode) body.researchMode = options.researchMode;
  if (options?.referenceUrls?.length)
    body.referenceUrls = options.referenceUrls;
  return api<IdeaResult>("/api/idea-to-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function generatePrompt(get: GetState, set: SetState) {
  const state = get();
  const source =
    state.idea.trim() || (state.attachments.length ? imageOnlyIdea : "");
  if (state.busy || source.length < 4) return;
  const revision = state.revision;
  set({ busy: true, status: "Reading your idea and shaping the prompt…" });
  try {
    const response = await requestPrompt(
      source,
      state.guidance,
      state.attachments.map(({ file }) => file),
      undefined,
      undefined,
      {
        researchMode: state.researchMode,
        referenceUrls: state.referenceUrl
          ? [state.referenceUrl.trim()]
          : undefined,
      },
    );
    if (revision !== get().revision) return;
    if (response.questions?.length) {
      set({
        pending: {
          idea: source,
          guidance: state.guidance,
          questions: response.questions,
          answers: response.questions.map(() => ""),
          imageCount: state.attachments.length,
          researchContext: response.research?.context,
          researchSources: response.research?.sources,
        },
        status: "A few details could change the result. Answer or skip.",
      });
    } else if (response.data) {
      set({
        result: response,
        ready: true,
        pending: null,
        status: "Prompt ready. Make it yours.",
      });
    } else throw new Error("The AI response did not contain a prompt.");
  } catch (error) {
    if (revision === get().revision)
      set({
        status:
          error instanceof Error ? error.message : "Could not shape this idea.",
      });
  } finally {
    set({ busy: false });
  }
}

export async function completePromptClarification(
  get: GetState,
  set: SetState,
  skip = false,
) {
  const state = get();
  if (!state.pending || state.busy) return;
  if ((state.pending.imageCount || 0) > state.attachments.length) {
    set({
      status: "Reattach your reference images before finishing this prompt.",
    });
    return;
  }
  const revision = state.revision;
  set({
    busy: true,
    status: "Shaping your prompt from your idea and answers…",
  });
  try {
    const { idea, guidance, questions, answers } = state.pending;
    const clarifications = questions.map((question, index) => ({
      question,
      answer: skip ? "" : answers[index].trim(),
    }));
    const response = await requestPrompt(
      idea,
      guidance,
      state.attachments.map(({ file }) => file),
      clarifications,
      state.pending.researchContext
        ? {
            context: state.pending.researchContext,
            sources: state.pending.researchSources,
          }
        : undefined,
    );
    if (revision !== get().revision) return;
    if (!response.data)
      throw new Error("Could not finish this prompt. Try again.");
    set({
      result: response,
      ready: true,
      pending: null,
      status: "Prompt ready. Make it yours.",
    });
  } catch (error) {
    if (revision === get().revision)
      set({
        status:
          error instanceof Error
            ? error.message
            : "Could not finish this prompt.",
      });
  } finally {
    set({ busy: false });
  }
}
