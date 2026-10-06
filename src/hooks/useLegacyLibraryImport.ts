"use client";

import { useEffect, useState } from "react";
import { api, json } from "@/lib/client/api";
import type { SavedPrompt } from "@/lib/prompt/types";

const promptsKey = "promptdock.prompts.v1";
const tokenKey = "promptdock.workspace-token.v1";
const inFlight = new Set<string>();

export function useLegacyLibraryImport(accountId: string) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (inFlight.has(accountId)) return;
    const raw = localStorage.getItem(promptsKey);
    const token = localStorage.getItem(tokenKey);
    if (!raw && !token) return;
    inFlight.add(accountId);
    async function migrate() {
      try {
        if (/^[a-f0-9]{64}$/.test(token || "")) {
          await api("/api/auth/import-legacy", {
            method: "POST",
            headers: { "X-Workspace-Token": token! },
          });
        }
        const saved = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(saved))
          throw new Error("Old library data is invalid.");
        if (saved.length) {
          const remote = await api<{ prompts: SavedPrompt[] }>(
            "/api/prompts/export",
          );
          const remoteIds = new Set(remote.prompts.map((item) => item.id));
          for (const item of saved as SavedPrompt[]) {
            if (!item?.id || remoteIds.has(item.id)) continue;
            await json("/api/prompts", "PUT", item);
          }
        }
        localStorage.removeItem(promptsKey);
        localStorage.removeItem(tokenKey);
        if (saved.length || token)
          setNotice(
            "Your earlier PromptDock library is now synced with your account.",
          );
      } catch {
        setNotice(
          "Your earlier browser prompts are still safe here. Library sync will retry when you refresh.",
        );
      } finally {
        inFlight.delete(accountId);
      }
    }
    void migrate();
  }, [accountId]);
  return notice;
}
