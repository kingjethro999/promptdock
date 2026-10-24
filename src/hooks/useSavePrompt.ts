"use client";

import { useCallback, useRef, useState } from "react";
import { usePromptBuilder } from "./usePromptBuilder";
import { json } from "@/lib/client/api";
import type { SavedPrompt } from "@/lib/prompt/types";

export function isDirty(
  data: unknown,
  sourcePrompt: SavedPrompt | null,
  name?: string,
): boolean {
  if (!sourcePrompt) return true;
  if (name !== undefined && name.trim() !== (sourcePrompt.name || "").trim()) {
    return true;
  }
  return JSON.stringify(data) !== JSON.stringify(sourcePrompt.data);
}

export function buildPayload(
  b: ReturnType<typeof usePromptBuilder>,
  overrides?: { name?: string; tags?: string[] },
  remixSourcePublicId?: string | null,
) {
  return {
    id: b.sourcePrompt?.id || crypto.randomUUID(),
    name:
      overrides?.name !== undefined
        ? overrides.name.trim() ||
          b.sourcePrompt?.name ||
          b.data?.task.slice(0, 90) ||
          ""
        : b.sourcePrompt?.name || b.data?.task.slice(0, 90) || "",
    data: b.data,
    idea: b.documentSource,
    analysis: b.result?.interpretation || b.sourcePrompt?.analysis || null,
    tags:
      overrides?.tags !== undefined
        ? overrides.tags
        : b.sourcePrompt?.tags || [],
    sourcePublicId: remixSourcePublicId || undefined,
  };
}

export function useSavePrompt({
  remixSourcePublicId,
}: {
  remixSourcePublicId: string | null;
}) {
  const builder = usePromptBuilder();
  const latest = useRef(builder);
  latest.current = builder;
  const inflight = useRef<Promise<SavedPrompt> | null>(null);
  const [phase, setPhase] = useState<"unsaved" | "saving" | "saved" | "error">(
    builder.sourcePrompt ? "saved" : "unsaved",
  );

  const dirty = isDirty(builder.data, builder.sourcePrompt);

  const ensureSaved = useCallback(
    (overrides?: { name?: string; tags?: string[] }): Promise<SavedPrompt> => {
      const b = latest.current;
      if (inflight.current) return inflight.current;
      if (!b.data) {
        return Promise.reject(new Error("There is nothing to save yet."));
      }
      if (b.sourcePrompt && !isDirty(b.data, b.sourcePrompt) && !overrides) {
        return Promise.resolve(b.sourcePrompt);
      }

      setPhase("saving");
      const p = json<{ prompt: SavedPrompt }>(
        "/api/prompts",
        "PUT",
        buildPayload(b, overrides, remixSourcePublicId),
      )
        .then(({ prompt }) => {
          latest.current.savedPrompt(prompt);
          setPhase("saved");
          return prompt;
        })
        .catch((e) => {
          setPhase("error");
          throw e;
        })
        .finally(() => {
          inflight.current = null;
        });

      return (inflight.current = p);
    },
    [remixSourcePublicId],
  );

  return {
    phase,
    dirty,
    saved: latest.current.sourcePrompt,
    ensureSaved,
  };
}
