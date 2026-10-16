"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import PromptCard from "./PromptCard";
import LibraryDialogs from "./LibraryDialogs";
import CollectionDialog from "./CollectionDialog";
import SearchSelect from "@/components/ui/SearchSelect";
import Button from "@/components/ui/Button";
import Masonry from "@/components/ui/Masonry";
import { Icon } from "@/components/ui/Icon";
import { useLibrary } from "@/hooks/useLibrary";
import { usePromptBuilderStore } from "@/stores/prompt-builder";
import { api, json } from "@/lib/client/api";
import type { SavedPrompt } from "@/lib/prompt/types";
import type { CollectionItem } from "@/components/collections/SaveToPanel";

export default function LibraryWorkspace({
  username,
}: {
  username: string | null;
}) {
  const router = useRouter();
  const loadPrompt = usePromptBuilderStore((state) => state.loadPrompt);
  const clear = usePromptBuilderStore((state) => state.clear);
  const [shareCandidate, setShareCandidate] = useState<SavedPrompt | null>(
    null,
  );

  // Collections state
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CollectionItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const library = useLibrary();
  const {
    prompts,
    setPrompts,
    total,
    q,
    setQ,
    tag,
    setTag,
    sort,
    setSort,
    offset,
    setOffset,
    collection,
    setCollection,
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
  } = library;

  const fetchCollections = useCallback(async () => {
    try {
      const data = await api<{ collections: CollectionItem[] }>(
        "/api/collections",
      );
      setCollections(data.collections || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const activeCollection = collections.find((c) => c.id === collection) || null;

  const copyCollectionLink = async (publicId: string) => {
    const url = `${window.location.origin}/c/${publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDeleteCollection = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await json(`/api/collections/${deleteTarget.id}`, "DELETE", {});
      setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (collection === deleteTarget.id) {
        setCollection(null);
        setOffset(0);
      }
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="library-view react-library-page">
      <div className="page-intro library-intro">
        <div>
          <div className="eyebrow">
            <Icon name="sparkles" size={13} className="eyebrow-star" /> YOUR
            COLLECTION
          </div>
          <h1 id="libraryHeading">
            Prompts worth <em>keeping.</em>
          </h1>
          <p>Find the prompts you saved and make them your own.</p>
        </div>
        <div className="library-intro-actions">
          <Button
            className="paste-prompt-button"
            onClick={() => setPasteOpen(true)}
          >
            <Icon name="file" size={14} />
            <span className="paste-prompt-label">Paste prompt</span>
          </Button>
          <Button
            variant="primary"
            className="new-prompt-button"
            onClick={() => {
              clear();
              router.push("/workspace");
            }}
          >
            <Icon name="plus" size={14} /> New prompt
          </Button>
        </div>
      </div>

      {/* Collections strip */}
      <div
        className="library-collections-strip"
        aria-label="Collections and playlists"
      >
        <div className="collection-chips">
          <button
            type="button"
            className={`collection-chip${!collection ? " is-active" : ""}`}
            onClick={() => {
              setCollection(null);
              setOffset(0);
            }}
          >
            <Icon name="library" size={13} />
            <span>All prompts</span>
          </button>

          {collections.map((col) => {
            const visIcon =
              col.visibility === "private"
                ? "lock"
                : col.visibility === "followers"
                  ? "users"
                  : "globe";
            return (
              <button
                key={col.id}
                type="button"
                className={`collection-chip${collection === col.id ? " is-active" : ""}`}
                onClick={() => {
                  setCollection(collection === col.id ? null : col.id);
                  setOffset(0);
                }}
                title={col.name}
              >
                <Icon name={visIcon} size={12} />
                <span>{col.name}</span>
                <span className="chip-count">{col.count}</span>
              </button>
            );
          })}

          <button
            type="button"
            className="collection-chip collection-chip-create"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size={13} />
            <span>New collection</span>
          </button>
        </div>
      </div>

      {/* Active collection banner */}
      {activeCollection && (
        <div className="active-collection-banner">
          <div className="active-collection-info">
            <div className="active-collection-badge">
              <Icon
                name={
                  activeCollection.visibility === "private"
                    ? "lock"
                    : activeCollection.visibility === "followers"
                      ? "users"
                      : "globe"
                }
                size={13}
              />
              <span>
                {activeCollection.visibility === "private"
                  ? "Private playlist"
                  : activeCollection.visibility === "followers"
                    ? "Followers only playlist"
                    : "Public playlist"}
              </span>
              {activeCollection.listed && (
                <span className="listed-tag">• Listed in Community</span>
              )}
            </div>
            <h2>{activeCollection.name}</h2>
            {activeCollection.description && (
              <p>{activeCollection.description}</p>
            )}
          </div>
          <div className="active-collection-actions">
            {activeCollection.publicId && (
              <Button
                variant="secondary"
                onClick={() =>
                  copyCollectionLink(activeCollection.publicId as string)
                }
              >
                <Icon name="link" size={14} />
                <span>{copiedLink ? "Link copied!" : "Share collection"}</span>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setEditTarget(activeCollection)}
            >
              <Icon name="pencil" size={14} />
              <span>Edit</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(activeCollection)}
              aria-label="Delete collection"
            >
              <Icon name="trash" size={14} />
            </Button>
          </div>
        </div>
      )}

      <div className="library-toolbar">
        <label className="search-box">
          <Icon name="search" size={14} />
          <input
            type="search"
            aria-label="Search saved prompts"
            placeholder="Search names, ideas, tasks, tags..."
            maxLength={100}
            value={q}
            onChange={(event) => {
              setOffset(0);
              setQ(event.target.value);
            }}
          />
        </label>
        <span>
          {loading && !prompts.length
            ? "Loading…"
            : `${total} saved prompt${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="library-filters">
        <div className="tag-chips" aria-label="Filter by tag">
          {tags.length ? (
            <>
              <button
                className={`tag-chip${tag === "" ? " is-active" : ""}`}
                onClick={() => {
                  setTag("");
                  setOffset(0);
                }}
              >
                All
              </button>
              {tags.map((item) => (
                <button
                  key={item}
                  className={`tag-chip${tag === item ? " is-active" : ""}`}
                  onClick={() => {
                    setTag(item);
                    setOffset(0);
                  }}
                >
                  {item}
                </button>
              ))}
            </>
          ) : (
            <span className="tag-chips-empty">
              Tag prompts when saving to filter them here.
            </span>
          )}
        </div>
        <div className="sort-control">
          <SearchSelect
            label="Sort"
            value={sort}
            options={[
              { value: "updated", label: "Recently updated" },
              { value: "name", label: "Name A–Z" },
            ]}
            onChange={(value) => {
              setOffset(0);
              setSort(value);
            }}
          />
        </div>
      </div>

      <div className="library-backup">
        <button className="text-button" type="button" onClick={exportBackup}>
          Export JSON <Icon name="arrow-down" size={12} />
        </button>
        <label className="text-button react-import-button">
          Import JSON <Icon name="arrow-up" size={12} />
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importBackup(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {notice && (
        <p role="status" className="settings-feedback">
          {notice}
        </p>
      )}

      {loadError && (
        <p role="alert" className="settings-feedback error">
          {loadError}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </p>
      )}

      {prompts.length === 0 && loading ? (
        <div className="library-loading-state" role="status">
          <div className="empty-state-icon">
            <Icon name="sparkles" size={24} />
          </div>
          <h3>Loading your library…</h3>
        </div>
      ) : prompts.length === 0 && activeCollection ? (
        <div className="library-loading-state" role="status">
          <div className="empty-state-icon">
            <Icon name="folder" size={24} />
          </div>
          <h3>No prompts in this playlist yet</h3>
          <p>
            Add prompts using the &quot;Save to…&quot; button on any prompt card
            or when saving in the workspace.
          </p>
        </div>
      ) : (
        <Masonry
          className="library-grid react-library-masonry"
          minColumnWidth={255}
          maxColumns={5}
          gap={15}
        >
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onOpen={(item) => {
                loadPrompt(item);
                router.push("/workspace");
              }}
              onDuplicate={duplicate}
              onShare={setShareCandidate}
              onDelete={setConfirm}
              onHistory={showHistory}
            />
          ))}
        </Masonry>
      )}

      {total > 100 && (
        <div className="react-pagination">
          <span>
            Showing {offset + 1}–{Math.min(offset + prompts.length, total)} of{" "}
            {total}
          </span>
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            Previous
          </button>
          <button
            disabled={offset + prompts.length >= total}
            onClick={() => setOffset(offset + 100)}
          >
            Next
          </button>
        </div>
      )}

      {/* Collection Dialogs */}
      <CollectionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(newCol) => {
          setCollections((prev) => [newCol, ...prev]);
          setCollection(newCol.id);
          setOffset(0);
        }}
      />

      <CollectionDialog
        open={Boolean(editTarget)}
        collection={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(updatedCol) => {
          setCollections((prev) =>
            prev.map((c) => (c.id === updatedCol.id ? updatedCol : c)),
          );
        }}
      />

      {/* Delete Collection Confirmation Modal */}
      {deleteTarget && (
        <div
          className="react-modal-backdrop"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <section
            className="react-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteCollectionTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-kicker">CONFIRM DELETION</div>
            <h2 id="deleteCollectionTitle">
              Delete &quot;{deleteTarget.name}&quot;?
            </h2>
            <p>
              This will remove the collection playlist. The prompts inside will
              remain safe in your library.
            </p>
            <div className="react-modal-actions">
              <Button
                variant="primary"
                onClick={handleDeleteCollection}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete collection"}
              </Button>
              <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </section>
        </div>
      )}

      <LibraryDialogs
        username={username}
        pasteOpen={pasteOpen}
        setPasteOpen={setPasteOpen}
        saving={saving}
        paste={paste}
        confirm={confirm}
        setConfirm={setConfirm}
        remove={remove}
        history={history}
        setHistory={setHistory}
        restore={restore}
        shareCandidate={shareCandidate}
        setShareCandidate={setShareCandidate}
        publish={share}
        onPromptUpdated={(updated) => {
          setPrompts((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
        }}
      />
    </div>
  );
}
