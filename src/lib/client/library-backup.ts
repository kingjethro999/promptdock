import { api, json } from "./api";
import type { SavedPrompt } from "@/lib/prompt/types";

export async function downloadLibraryBackup() {
  const result = await api<{ prompts: SavedPrompt[] }>("/api/prompts/export");
  const contents = JSON.stringify(
    { version: 1, prompts: result.prompts },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "promptdock-library.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function uploadLibraryBackup(file: File) {
  const backup = JSON.parse(await file.text());
  if (!Array.isArray(backup.prompts))
    throw new Error("Choose a PromptDock JSON backup.");
  await json("/api/prompts/import", "POST", {
    version: 1,
    prompts: backup.prompts,
  });
}
