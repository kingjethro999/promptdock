import { api, json } from "./api";
import type { SavedPrompt } from "@/lib/prompt/types";

export type Revision = {
  revisionId: number;
  name: string;
  data: SavedPrompt["data"];
  idea: string;
  analysis?: SavedPrompt["analysis"];
  tags?: string[];
  createdAt: string;
};

export async function listLibrary(query: URLSearchParams) {
  const [listing, tagResult] = await Promise.all([
    api<{ prompts: SavedPrompt[]; total: number }>(`/api/prompts?${query}`),
    api<{ tags: { tag: string; count: number }[] | string[] }>(
      "/api/prompts/tags",
    ),
  ]);
  return {
    ...listing,
    tags: tagResult.tags.map((item) =>
      typeof item === "string" ? item : item.tag,
    ),
  };
}

export const duplicatePrompt = (id: string) =>
  api(`/api/prompts/${id}/duplicate`, { method: "POST" });

export const setPromptPublic = (id: string, published: boolean) =>
  json<{ prompt: SavedPrompt }>(`/api/prompts/${id}/public`, "PATCH", {
    published,
  });

export const deletePrompt = (id: string) =>
  api(`/api/prompts/${id}`, { method: "DELETE" });

export async function listRevisions(id: string) {
  return (await api<{ revisions: Revision[] }>(`/api/prompts/${id}/revisions`))
    .revisions;
}

export const restorePrompt = (id: string, revisionId: number) =>
  api(`/api/prompts/${id}/revisions/${revisionId}/restore`, { method: "POST" });

export const pastePrompt = (name: string, content: string, tagList: string) =>
  json("/api/prompts", "PUT", {
    id: crypto.randomUUID(),
    name: name.trim(),
    idea: content,
    data: { task: content, raw: true },
    analysis: null,
    tags: tagList
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  });

/**
 * Edit a saved prompt in place: title, tags and text. Structured prompts keep
 * their fields unless the text itself changed, in which case the edited text
 * becomes the prompt.
 */
export const updatePromptDetails = (
  prompt: SavedPrompt,
  details: {
    name: string;
    content: string;
    tags: string[];
    textChanged: boolean;
  },
) =>
  json<{ prompt: SavedPrompt }>("/api/prompts", "PUT", {
    id: prompt.id,
    name: details.name.trim(),
    idea: prompt.idea,
    data: details.textChanged
      ? { task: details.content, raw: true }
      : prompt.data,
    analysis: details.textChanged ? null : prompt.analysis || null,
    tags: details.tags,
  });
