"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PromptCard from "./PromptCard";
import LibraryDialogs from "./LibraryDialogs";
import SearchSelect from "@/components/ui/SearchSelect";
import Button from "@/components/ui/Button";
import Masonry from "@/components/ui/Masonry";
import { useLibrary } from "@/hooks/useLibrary";
import { usePromptBuilderStore } from "@/stores/prompt-builder";
import type { SavedPrompt } from "@/lib/prompt/types";

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
  const library = useLibrary();
  const {
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
  } = library;

  return (
    <div className="library-view react-library-page">
      <div className="page-intro library-intro">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-star">✳</span> YOUR COLLECTION
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
            <span aria-hidden="true">⎘</span>{" "}
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
            ＋ New prompt
          </Button>
        </div>
      </div>
      <div className="library-toolbar">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
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
          Export JSON ↓
        </button>
        <label className="text-button react-import-button">
          Import JSON ↑
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
        {prompts.length === 0 && loading && (
          <div className="empty-state" role="status">
            <div className="empty-state-icon">✳</div>
            <h3>Loading your library…</h3>
          </div>
        )}
        {prompts.length === 0 && !loading && loadError && (
          <div className="empty-state" role="alert">
            <div className="empty-state-icon">✳</div>
            <h3>Could not load your library</h3>
            <p>{loadError}</p>
            <Button variant="primary" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        )}
        {prompts.length === 0 && !loading && !loadError && (
          <div className="empty-state">
            <div className="empty-state-icon">✳</div>
            <h3>
              {q || tag ? "No matching prompts" : "Your library starts here"}
            </h3>
            <p>
              {q || tag
                ? "Try a different search term, or clear the tag filter."
                : "Save a prompt from the builder and it will appear here."}
            </p>
            {!q && !tag && (
              <Button
                variant="primary"
                onClick={() => {
                  clear();
                  router.push("/workspace");
                }}
              >
                Create a prompt
              </Button>
            )}
          </div>
        )}
      </Masonry>
      {total > 100 && (
        <div className="react-pagination">
          <span>
            {Math.min(offset + 1, total)}–
            {Math.min(offset + prompts.length, total)} of {total}
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
      />
    </div>
  );
}
