"use client";

import React, { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { json } from "@/lib/client/api";
import type { Visibility } from "@/lib/community/access";
import type { CollectionItem } from "@/components/collections/SaveToPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  collection?: CollectionItem | null;
  onSaved: (col: CollectionItem) => void;
}

export default function CollectionDialog({
  open,
  onClose,
  collection,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [listed, setListed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (collection) {
        setName(collection.name);
        setDescription(collection.description || "");
        setVisibility(collection.visibility);
        setListed(collection.listed);
      } else {
        setName("");
        setDescription("");
        setVisibility("private");
        setListed(false);
      }
      setError(null);
    }
  }, [open, collection]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (collection) {
        const { collection: updated } = await json<{
          collection: CollectionItem;
        }>(`/api/collections/${collection.id}`, "PATCH", {
          name: trimmed,
          description: description.trim(),
          visibility,
          listed: visibility !== "private" ? listed : false,
        });
        onSaved(updated);
      } else {
        const { collection: created } = await json<{
          collection: CollectionItem;
        }>("/api/collections", "POST", {
          name: trimmed,
          description: description.trim() || undefined,
          visibility,
          listed: visibility !== "private" ? listed : false,
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message.includes("name_taken")) {
        setError("A collection with this name already exists.");
      } else {
        setError(
          err instanceof Error ? err.message : "Could not save collection.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="react-modal-backdrop" onClick={onClose}>
      <section
        className="react-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collectionDialogTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="react-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>

        <div className="section-kicker">
          {collection ? "EDIT PLAYLIST" : "NEW PLAYLIST"}
        </div>
        <h2 id="collectionDialogTitle">
          {collection ? "Edit Collection" : "Create Collection"}
        </h2>
        <p>
          Organize your prompts into a playlist or series that can be shared as
          a sequence.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="react-field">
            <span>Collection name</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Coding Prompts"
              autoFocus
            />
          </label>

          <label className="react-field">
            <span>Description (optional)</span>
            <textarea
              maxLength={300}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this series covers and who it is for..."
            />
          </label>

          <label className="react-field">
            <span>Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              <option value="private">Private (only you)</option>
              <option value="followers">Followers only</option>
              <option value="public">Public (anyone with the link)</option>
            </select>
          </label>

          {visibility !== "private" && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                className="ui-check"
                checked={listed}
                onChange={(e) => setListed(e.target.checked)}
              />
              <span style={{ fontSize: "13px", color: "var(--ui-fg)" }}>
                List this collection in the Community feed & on your profile
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="settings-feedback">
              {error}
            </p>
          )}

          <div className="react-modal-actions" style={{ marginTop: "20px" }}>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : collection ? "Save changes" : "Create"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
