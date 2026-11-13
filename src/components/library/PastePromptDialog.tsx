"use client";

import { useEffect, useRef, useState } from "react";
import ModalFrame from "@/components/ui/ModalFrame";
import Button from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const MAX_TITLE = 120;
const MAX_PROMPT = 100000;
const MAX_TAGS = 8;
const MAX_TAG = 24;
// Same rule the server applies when saving.
const TAG_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

type Errors = { name?: string; content?: string; tags?: string; form?: string };

function tagProblem(tag: string, existing: string[]): string | null {
  if (tag.length > MAX_TAG) return `Tags can be up to ${MAX_TAG} characters.`;
  if (!TAG_RE.test(tag))
    return "Tags start with a letter or number and use letters, numbers, spaces, - or _.";
  if (existing.some((item) => item.toLowerCase() === tag.toLowerCase()))
    return "That tag is already added.";
  if (existing.length >= MAX_TAGS) return `Use up to ${MAX_TAGS} tags.`;
  return null;
}

/** Composer for adding a prompt written elsewhere to the library. */
export default function PastePromptDialog({
  close,
  saving,
  paste,
}: {
  close(): void;
  saving: boolean;
  paste(
    name: string,
    content: string,
    tags: string,
  ): Promise<boolean | undefined>;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [clipboardNote, setClipboardNote] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const tagInput = useRef<HTMLInputElement>(null);

  // Grow with the text up to the CSS max-height, then scroll inside.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [content]);

  /**
   * Adds every complete tag in `raw`. Text can arrive with several commas at
   * once (a pasted "a, b, c"), so it is split rather than treated as one tag.
   * Whatever follows the last comma stays in the field to keep typing.
   */
  function addTags(raw: string, keepTail: boolean) {
    const parts = raw.split(",");
    const tail = keepTail ? (parts.pop() ?? "") : "";
    const next = [...tags];
    let problem: string | null = null;
    for (const part of parts) {
      const tag = part.trim().replace(/\s+/g, " ");
      if (!tag) continue;
      problem = tagProblem(tag, next);
      if (problem) {
        // Keep the rejected text so it can be corrected, not lost.
        setTags(next);
        setTagDraft(
          [part.trim(), ...(keepTail && tail.trim() ? [tail.trim()] : [])].join(
            ", ",
          ),
        );
        setErrors((current) => ({ ...current, tags: problem! }));
        return false;
      }
      next.push(tag);
    }
    setTags(next);
    setTagDraft(tail.trimStart());
    setErrors((current) => ({ ...current, tags: undefined }));
    return true;
  }

  async function fromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return setClipboardNote("Your clipboard is empty.");
      setContent(text.slice(0, MAX_PROMPT));
      setClipboardNote(
        text.length > MAX_PROMPT
          ? "Pasted. The text was longer than the limit and was shortened."
          : "Pasted from your clipboard.",
      );
      setErrors((current) => ({ ...current, content: undefined }));
      textarea.current?.focus();
    } catch {
      setClipboardNote(
        "Clipboard access was blocked. Click the box and press Ctrl/Cmd + V.",
      );
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const next: Errors = {};
    if (!name.trim()) next.name = "Give your prompt a title.";
    if (!content.trim()) next.content = "Paste or type the prompt text.";
    const pending = tagDraft.trim().replace(/\s+/g, " ");
    const pendingProblem = pending ? tagProblem(pending, tags) : null;
    if (pendingProblem) next.tags = pendingProblem;
    setErrors(next);
    if (next.name) return nameInput.current?.focus();
    if (next.content) return textarea.current?.focus();
    if (next.tags) return tagInput.current?.focus();
    const allTags = pending ? [...tags, pending] : tags;
    if (await paste(name, content, allTags.join(", "))) close();
    else
      setErrors({
        form: "Could not save this prompt. Check your connection and try again.",
      });
  }

  const count = content.length;
  const nearLimit = count > MAX_PROMPT * 0.95;
  return (
    <ModalFrame
      title="Paste a prompt"
      kicker="Library"
      description="Keep a prompt you wrote elsewhere. It stays private until you choose to share it."
      size="lg"
      className="paste-modal"
      close={close}
      footer={
        <>
          <span className="pd-modal__foot-note" role="status">
            {errors.form || ""}
          </span>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="pastePromptForm"
            disabled={saving}
            loading={saving}
            loadingText="Saving…"
          >
            Save to library
          </Button>
        </>
      }
    >
      <form id="pastePromptForm" onSubmit={submit} noValidate>
        <div className="pd-field">
          <label className="pd-label" htmlFor="reactPasteName">
            Title
          </label>
          <input
            ref={nameInput}
            id="reactPasteName"
            className="pd-input"
            // The dialog would otherwise focus its close button first.
            autoFocus
            type="text"
            maxLength={MAX_TITLE}
            autoComplete="off"
            placeholder="e.g. Weekly report summarizer"
            value={name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "reactPasteNameError" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
          />
          {errors.name && (
            <p className="pd-error" id="reactPasteNameError">
              {errors.name}
            </p>
          )}
        </div>

        <div className="pd-field">
          <label className="pd-label" htmlFor="reactPasteText">
            Prompt
          </label>
          <div
            className="pd-editor"
            data-invalid={errors.content ? "true" : undefined}
          >
            <div className="pd-editor__bar">
              <span className="pd-editor__hint">Plain text, any length</span>
              <div className="pd-editor__tools">
                <button type="button" onClick={fromClipboard}>
                  <Icon name="copy" size={14} />
                  Paste from clipboard
                </button>
                <button
                  type="button"
                  disabled={!content}
                  onClick={() => {
                    setContent("");
                    setClipboardNote("");
                    textarea.current?.focus();
                  }}
                >
                  <Icon name="trash" size={14} />
                  Clear
                </button>
              </div>
            </div>
            <textarea
              ref={textarea}
              id="reactPasteText"
              className="pd-editor__text"
              rows={8}
              maxLength={MAX_PROMPT}
              spellCheck={false}
              placeholder="Paste or type the full prompt here."
              value={content}
              aria-invalid={Boolean(errors.content)}
              aria-describedby={`reactPasteCount${errors.content ? " reactPasteTextError" : ""}`}
              onChange={(event) => {
                setContent(event.target.value);
                if (errors.content)
                  setErrors({ ...errors, content: undefined });
              }}
            />
            <div className="pd-editor__status">
              <span role="status">{clipboardNote}</span>
              <span
                id="reactPasteCount"
                className={nearLimit ? "is-near-limit" : undefined}
              >
                {count.toLocaleString()} / {MAX_PROMPT.toLocaleString()}
              </span>
            </div>
          </div>
          {errors.content && (
            <p className="pd-error" id="reactPasteTextError">
              {errors.content}
            </p>
          )}
        </div>

        <div className="pd-field">
          <label className="pd-label" htmlFor="reactPasteTags">
            Tags{" "}
            <span className="pd-label__aside">Optional, up to {MAX_TAGS}</span>
          </label>
          <div
            className="pd-tags"
            data-invalid={errors.tags ? "true" : undefined}
            onClick={() => tagInput.current?.focus()}
          >
            {tags.map((tag) => (
              <span className="pd-tag" key={tag}>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => {
                    setTags(tags.filter((item) => item !== tag));
                    setErrors({ ...errors, tags: undefined });
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            <input
              ref={tagInput}
              id="reactPasteTags"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="done"
              placeholder={
                tags.length >= MAX_TAGS
                  ? ""
                  : tags.length
                    ? "Add another"
                    : "Type a tag and press Enter"
              }
              disabled={tags.length >= MAX_TAGS}
              value={tagDraft}
              aria-invalid={Boolean(errors.tags)}
              aria-describedby={`reactPasteTagsHint${errors.tags ? " reactPasteTagsError" : ""}`}
              onChange={(event) => {
                const value = event.target.value;
                if (value.includes(",")) addTags(value, true);
                else {
                  setTagDraft(value);
                  if (errors.tags) setErrors({ ...errors, tags: undefined });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && tagDraft.trim()) {
                  event.preventDefault();
                  addTags(tagDraft, false);
                } else if (
                  event.key === "Backspace" &&
                  !tagDraft &&
                  tags.length
                )
                  setTags(tags.slice(0, -1));
              }}
              onBlur={() => tagDraft.trim() && addTags(tagDraft, false)}
            />
          </div>
          <p className="pd-hint" id="reactPasteTagsHint">
            Press Enter or type a comma to add a tag. Tags help you find it in
            search and in Community.
          </p>
          {errors.tags && (
            <p className="pd-error" id="reactPasteTagsError">
              {errors.tags}
            </p>
          )}
        </div>
      </form>
    </ModalFrame>
  );
}
