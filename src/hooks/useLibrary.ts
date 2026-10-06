"use client";

import { useCallback, useEffect, useState } from "react";
import {
  downloadLibraryBackup,
  uploadLibraryBackup,
} from "@/lib/client/library-backup";
import {
  listLibrary,
  duplicatePrompt,
  setPromptPublic,
  deletePrompt,
  listRevisions,
  restorePrompt,
  pastePrompt,
  type Revision,
} from "@/lib/client/library-operations";
import type { SavedPrompt } from "@/lib/prompt/types";

export type { Revision } from "@/lib/client/library-operations";

function errorNotice(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useLibrary() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("updated");
  const [offset, setOffset] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<SavedPrompt | null>(null);
  const [history, setHistory] = useState<{
    prompt: SavedPrompt;
    revisions: Revision[];
    loading: boolean;
    error: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const query = new URLSearchParams({
        q,
        tag,
        sort,
        offset: String(offset),
      });
      let listing: Awaited<ReturnType<typeof listLibrary>> | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          listing = await listLibrary(query);
          break;
        } catch (error) {
          if (attempt === 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (!listing) throw new Error("Could not load your library.");
      setPrompts(listing.prompts);
      setTotal(listing.total);
      setTags(listing.tags);
      setNotice("");
    } catch (error) {
      setLoadError(errorNotice(error, "Could not load your library."));
    } finally {
      setLoading(false);
    }
  }, [q, tag, sort, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function duplicate(prompt: SavedPrompt) {
    try {
      await duplicatePrompt(prompt.id);
      await refresh();
      setNotice("Copy saved.");
    } catch (error) {
      setNotice(errorNotice(error, "Could not duplicate prompt."));
    }
  }

  async function share(prompt: SavedPrompt, published: boolean) {
    try {
      const result = await setPromptPublic(prompt.id, published);
      await refresh();
      if (result.prompt.publicId) {
        const url = `${location.origin}/p/${result.prompt.publicId}`;
        try {
          await navigator.clipboard.writeText(url);
          setNotice(
            "Public link copied. Anyone with the link can view and copy this prompt.",
          );
        } catch {
          setNotice(
            `Prompt published. Copy its link from the public page: ${url}`,
          );
        }
      } else setNotice("Prompt is private again.");
      return result.prompt;
    } catch (error) {
      setNotice(errorNotice(error, "Could not update sharing."));
    }
  }

  async function remove() {
    if (!confirm) return;
    try {
      await deletePrompt(confirm.id);
      setConfirm(null);
      await refresh();
      setNotice("Prompt deleted.");
    } catch (error) {
      setNotice(errorNotice(error, "Could not delete prompt."));
    }
  }

  async function showHistory(prompt: SavedPrompt) {
    setHistory({ prompt, revisions: [], loading: true, error: "" });
    try {
      const revisions = await listRevisions(prompt.id);
      setHistory((current) =>
        current?.prompt.id === prompt.id
          ? { prompt, revisions, loading: false, error: "" }
          : current,
      );
    } catch (error) {
      setHistory((current) =>
        current?.prompt.id === prompt.id
          ? {
              prompt,
              revisions: [],
              loading: false,
              error: errorNotice(error, "Could not load history."),
            }
          : current,
      );
    }
  }

  async function restore(revision: Revision) {
    if (!history) return;
    try {
      await restorePrompt(history.prompt.id, revision.revisionId);
      setHistory(null);
      await refresh();
      setNotice("Previous version restored.");
    } catch (error) {
      setNotice(errorNotice(error, "Could not restore version."));
    }
  }

  async function paste(name: string, content: string, tagList: string) {
    if (saving) return;
    setSaving(true);
    try {
      await pastePrompt(name, content, tagList);
      setPasteOpen(false);
      await refresh();
      setNotice("Prompt added to your library.");
      return true;
    } catch (error) {
      setNotice(errorNotice(error, "Could not save prompt."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup() {
    try {
      await downloadLibraryBackup();
    } catch (error) {
      setNotice(errorNotice(error, "Could not export library."));
    }
  }

  async function importBackup(file: File) {
    try {
      await uploadLibraryBackup(file);
      await refresh();
      setNotice("Library imported.");
    } catch (error) {
      setNotice(errorNotice(error, "Could not import library."));
    }
  }

  return {
    prompts,
    total,
    q,
    setQ,
    tag,
    setTag,
    sort,
    setSort,
    offset,
    setOffset,
    tags,
    notice,
    loading,
    loadError,
    refresh,
    pasteOpen,
    setPasteOpen,
    saving,
    confirm,
    setConfirm,
    history,
    setHistory,
    duplicate,
    share,
    remove,
    showHistory,
    restore,
    paste,
    exportBackup,
    importBackup,
  };
}
