"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { api, json } from "@/lib/client/api";
import type { useSavePrompt } from "@/hooks/useSavePrompt";
import type { Visibility } from "@/lib/community/access";

export type SaveTarget =
  | {
      kind: "draft";
      save: ReturnType<typeof useSavePrompt>;
      onOpenDetails?: () => void;
    }
  | {
      kind: "saved";
      promptId: string;
      promptTitle?: string;
      onOpenDetails?: () => void;
    }
  | {
      kind: "community";
      publicId: string;
      promptTitle?: string;
    };

export interface CollectionItem {
  id: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  listed: boolean;
  publicId: string | null;
  count: number;
  hasPrompt: boolean;
}

export interface SaveToPanelProps {
  target: SaveTarget;
  onDone?: () => void;
  className?: string;
}

export function SaveToPanel({
  target,
  onDone,
  className = "",
}: SaveToPanelProps) {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prompt id resolution
  const [resolvedPromptId, setResolvedPromptId] = useState<string | null>(
    () => {
      if (target.kind === "saved") return target.promptId;
      if (target.kind === "draft" && target.save.saved?.id)
        return target.save.saved.id;
      return null;
    },
  );

  // Keep resolvedPromptId updated if draft gets saved externally
  useEffect(() => {
    if (target.kind === "draft" && target.save.saved?.id) {
      setResolvedPromptId(target.save.saved.id);
    } else if (target.kind === "saved") {
      setResolvedPromptId(target.promptId);
    }
  }, [target]);

  // Inline collection creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVisibility, setNewVisibility] = useState<Visibility>("private");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inflight mutation tracking for rapid clicks
  const mutatingRef = useRef<Set<string>>(new Set());

  // Ensure prompt exists in library and return prompt ID
  const ensurePromptId = useCallback(async (): Promise<string> => {
    if (resolvedPromptId) return resolvedPromptId;

    if (target.kind === "saved") {
      setResolvedPromptId(target.promptId);
      return target.promptId;
    }

    if (target.kind === "draft") {
      const saved = await target.save.ensureSaved();
      setResolvedPromptId(saved.id);
      return saved.id;
    }

    if (target.kind === "community") {
      const res = await json<{ id: string }>(
        `/api/community/prompts/${encodeURIComponent(target.publicId)}/save`,
        "POST",
        {},
      );
      setResolvedPromptId(res.id);
      return res.id;
    }

    throw new Error("Unable to resolve prompt");
  }, [resolvedPromptId, target]);

  // Fetch collections on mount or when prompt id changes
  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = resolvedPromptId
        ? `/api/collections?prompt=${encodeURIComponent(resolvedPromptId)}`
        : "/api/collections";
      const data = await api<{ collections: CollectionItem[] }>(url);
      setCollections(data.collections || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load collections",
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedPromptId]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Handle toggling collection membership
  const toggleCollection = async (
    collectionId: string,
    willHavePrompt: boolean,
  ) => {
    if (mutatingRef.current.has(collectionId)) return;
    mutatingRef.current.add(collectionId);

    // Optimistic update
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              hasPrompt: willHavePrompt,
              count: willHavePrompt ? c.count + 1 : Math.max(0, c.count - 1),
            }
          : c,
      ),
    );
    setError(null);

    try {
      const pid = await ensurePromptId();
      if (willHavePrompt) {
        await json(`/api/collections/${collectionId}/items`, "POST", {
          promptId: pid,
        });
      } else {
        await json(
          `/api/collections/${collectionId}/items/${pid}`,
          "DELETE",
          {},
        );
      }
    } catch (err) {
      // Revert on error
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                hasPrompt: !willHavePrompt,
                count: !willHavePrompt ? c.count + 1 : Math.max(0, c.count - 1),
              }
            : c,
        ),
      );
      setError(
        err instanceof Error ? err.message : "Failed to update collection",
      );
    } finally {
      mutatingRef.current.delete(collectionId);
    }
  };

  // Handle creating a new collection
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setCreateError(null);

    try {
      const { collection } = await json<{ collection: CollectionItem }>(
        "/api/collections",
        "POST",
        {
          name: trimmed,
          visibility: newVisibility,
        },
      );

      // Auto-add current prompt to newly created collection
      const pid = await ensurePromptId();
      await json(`/api/collections/${collection.id}/items`, "POST", {
        promptId: pid,
      });

      const newEntry: CollectionItem = {
        ...collection,
        count: 1,
        hasPrompt: true,
      };

      setCollections((prev) => [newEntry, ...prev]);
      setNewName("");
      setIsCreating(false);
    } catch (err) {
      if (err instanceof Error && err.message.includes("name_taken")) {
        setCreateError("You already have a collection with this name.");
      } else {
        setCreateError(
          err instanceof Error ? err.message : "Could not create collection",
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const isSaved = Boolean(resolvedPromptId);

  return (
    <div className={`save-to-panel ${className}`.trim()}>
      <div className="save-to-header">
        <div className="save-to-title-row">
          <span className="save-to-title">
            {isSaved ? "Saved to Library" : "Save to..."}
          </span>
          <button
            type="button"
            className="save-to-close-btn"
            onClick={onDone}
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {isSaved && (
          <div className="save-to-status">
            <Icon
              name="check-circle"
              size={14}
              className="save-to-status-icon"
            />
            <span>Saved to your library</span>
            {resolvedPromptId && (
              <Link
                href={`/library?prompt=${resolvedPromptId}`}
                className="save-to-status-link"
              >
                View
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="save-to-body">
        <div className="save-to-section-label">Add to playlist or folder:</div>

        {loading ? (
          <div className="save-to-loading">
            <Icon name="refresh" size={16} className="save-to-spin" />
            <span>Loading collections…</span>
          </div>
        ) : error && collections.length === 0 ? (
          <div className="save-to-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="ui-btn ui-btn--sm"
              onClick={fetchCollections}
            >
              Retry
            </button>
          </div>
        ) : collections.length === 0 && !isCreating ? (
          <div className="save-to-empty">
            <p>
              No collections yet. Group your prompts into a playlist or series.
            </p>
          </div>
        ) : (
          <ul className="save-to-list" role="list">
            {collections.map((col) => {
              const visIcon =
                col.visibility === "private"
                  ? "lock"
                  : col.visibility === "followers"
                    ? "users"
                    : "globe";

              return (
                <li key={col.id} className="save-to-item">
                  <label className="save-to-row">
                    <input
                      type="checkbox"
                      className="ui-check"
                      checked={col.hasPrompt}
                      onChange={(e) =>
                        toggleCollection(col.id, e.target.checked)
                      }
                    />
                    <span className="save-to-name" title={col.name}>
                      {col.name}
                    </span>
                    <span
                      className="save-to-badge"
                      title={
                        col.visibility === "private"
                          ? "Private"
                          : col.visibility === "followers"
                            ? "Followers only"
                            : "Public"
                      }
                    >
                      <Icon name={visIcon} size={13} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {error && collections.length > 0 && (
          <p className="save-to-error-text" role="alert">
            {error}
          </p>
        )}

        {/* Inline Create Row / Form */}
        <div className="save-to-create-wrap">
          {!isCreating ? (
            <button
              type="button"
              className="save-to-new-btn"
              onClick={() => setIsCreating(true)}
            >
              <Icon name="plus" size={15} />
              <span>New collection</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="save-to-create-form">
              <input
                type="text"
                className="save-to-input"
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
                autoFocus
                disabled={creating}
                required
              />

              <div className="save-to-create-controls">
                <select
                  className="save-to-select"
                  value={newVisibility}
                  onChange={(e) =>
                    setNewVisibility(e.target.value as Visibility)
                  }
                  disabled={creating}
                  aria-label="Collection visibility"
                >
                  <option value="private">Private</option>
                  <option value="followers">Followers only</option>
                  <option value="public">Public</option>
                </select>

                <div className="save-to-create-actions">
                  <button
                    type="button"
                    className="save-to-btn-cancel"
                    onClick={() => {
                      setIsCreating(false);
                      setNewName("");
                      setCreateError(null);
                    }}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ui-btn ui-btn--sm ui-btn--primary"
                    disabled={creating || !newName.trim()}
                  >
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>

              {createError && (
                <p className="save-to-error-text" role="alert">
                  {createError}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      <div className="save-to-footer">
        {target.kind !== "community" && target.onOpenDetails && (
          <button
            type="button"
            className="save-to-details-btn"
            onClick={() => {
              onDone?.();
              target.onOpenDetails?.();
            }}
          >
            <Icon name="pencil" size={13} />
            <span>Name and tags</span>
          </button>
        )}

        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--primary save-to-done-btn"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}
