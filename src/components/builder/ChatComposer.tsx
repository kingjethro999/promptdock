"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import type { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useOnline } from "@/hooks/useOnline";
import { useVoiceIdea } from "@/hooks/useVoiceIdea";

type Builder = ReturnType<typeof usePromptBuilder>;

/** A non-image file read as text and sent along with the message. */
export type ChatDoc = {
  id: string;
  name: string;
  size: number;
  text: string;
  truncated: boolean;
};

export type AddOn = {
  key: string;
  label: string;
  icon: IconName;
  open(): void;
};

export const MAX_ATTACHMENTS = 10;
const MAX_RECORD_SECONDS = 10 * 60;
const MAX_DOC_CHARS = 60_000;
const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? name
        .slice(dot + 1)
        .toUpperCase()
        .slice(0, 5)
    : "FILE";
}

function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** GIF, BMP, AVIF and friends become PNG so the vision models accept them. */
async function toPng(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("convert");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", {
      type: "image/png",
    });
  } finally {
    bitmap.close();
  }
}

/** Text if the first 8 KB holds no NUL bytes; binary formats always do. */
async function looksLikeText(file: File) {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  return !head.includes(0);
}

export default function ChatComposer({
  builder,
  text,
  setText,
  docs,
  setDocs,
  refining,
  hasPrompt,
  refine,
  setRefine,
  addOns,
  showNewChat,
  onSend,
  openSheet,
  newChat,
}: {
  builder: Builder;
  text: string;
  setText(value: string | ((current: string) => string)): void;
  docs: ChatDoc[];
  setDocs(value: ChatDoc[] | ((current: ChatDoc[]) => ChatDoc[])): void;
  refining: boolean;
  hasPrompt: boolean;
  refine: boolean;
  setRefine(value: boolean): void;
  addOns: AddOn[];
  showNewChat: boolean;
  onSend(override?: string): void;
  openSheet(kind: "tune" | "research"): void;
  newChat(): void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const plusButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const online = useOnline();

  const voice = useVoiceIdea(
    (spoken, reason) => {
      const combined = [text.trim(), spoken.trim()].filter(Boolean).join("\n");
      if (reason === "limit") {
        // Ten minutes is the cap: send what was said rather than lose it.
        setText("");
        onSend(combined);
      } else {
        setText(combined);
        input.current?.focus();
      }
    },
    { maxSeconds: MAX_RECORD_SECONDS },
  );

  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 320)}px`;
  }, [text]);

  const count = builder.attachments.length + docs.length;
  const usable = text.trim().length >= 4 || count > 0;
  const recording = voice.phase !== "idle";
  const canSend =
    usable && online && !builder.busy && !builder.pending && !recording;

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    let room = MAX_ATTACHMENTS - count;
    const problems: string[] = [];
    const images: File[] = [];
    const added: ChatDoc[] = [];
    for (const file of files) {
      if (room <= 0) {
        problems.push(`Up to ${MAX_ATTACHMENTS} attachments per message.`);
        break;
      }
      try {
        if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
          images.push(VISION_TYPES.has(file.type) ? file : await toPng(file));
          room -= 1;
          continue;
        }
        if (file.size > 5_000_000 || !(await looksLikeText(file))) {
          problems.push(
            /\.(pdf|docx?|pptx?|xlsx?|key|pages)$/i.test(file.name)
              ? `${file.name}: PDFs and Office files can't be read yet. Paste the text, or attach a screenshot.`
              : `${file.name}: only images and text files can be read.`,
          );
          continue;
        }
        const content = await file.text();
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          text: content.slice(0, MAX_DOC_CHARS),
          truncated: content.length > MAX_DOC_CHARS,
        });
        room -= 1;
      } catch {
        problems.push(`${file.name}: could not be read.`);
      }
    }
    if (images.length) {
      try {
        builder.addImages(images);
      } catch (error) {
        problems.push(
          error instanceof Error ? error.message : "Could not add images.",
        );
      }
    }
    if (added.length) setDocs((current) => [...current, ...added]);
    setNotice(problems[0] || "");
  }

  const hint = notice
    ? notice
    : !online
      ? "You're offline. Your message stays here until you reconnect."
      : voice.phase === "sending"
        ? "Turning your recording into text…"
        : builder.pending
          ? "Answer the questions above, or skip them."
          : "Enter to send · Shift+Enter for a new line";

  return (
    <div className="chat-dock">
      {hasPrompt && (
        <div
          className="chat-mode"
          role="group"
          aria-label="What your next message does"
        >
          <button
            type="button"
            aria-pressed={refine}
            onClick={() => setRefine(true)}
          >
            Revise this prompt
          </button>
          <button
            type="button"
            aria-pressed={!refine}
            onClick={() => setRefine(false)}
          >
            Start from a new idea
          </button>
        </div>
      )}
      <form
        className={`chat-composer${dragging ? " is-dragging" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSend();
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        {(count > 0 || addOns.length > 0) && (
          <div
            className="chat-attachments"
            aria-label="Attached to this message"
          >
            {builder.attachments.map((item, index) => (
              <figure className="chat-tile chat-tile--image" key={item.preview}>
                <img src={item.preview} alt={item.file.name} />
                <button
                  type="button"
                  className="chat-tile__remove"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => builder.removeImage(index)}
                >
                  <Icon name="x" size={12} strokeWidth={2.5} />
                </button>
              </figure>
            ))}
            {docs.map((doc) => (
              <figure className="chat-tile chat-tile--file" key={doc.id}>
                <figcaption>
                  <strong title={doc.name}>{doc.name}</strong>
                  <span>
                    {readableSize(doc.size)}
                    {doc.truncated ? " · first part only" : ""}
                  </span>
                </figcaption>
                <span className="chat-tile__ext">{extension(doc.name)}</span>
                <button
                  type="button"
                  className="chat-tile__remove"
                  aria-label={`Remove ${doc.name}`}
                  onClick={() =>
                    setDocs((current) =>
                      current.filter((item) => item.id !== doc.id),
                    )
                  }
                >
                  <Icon name="x" size={12} strokeWidth={2.5} />
                </button>
              </figure>
            ))}
            {addOns.map((addOn) => (
              <button
                type="button"
                className="chat-chip"
                key={addOn.key}
                onClick={addOn.open}
              >
                <Icon name={addOn.icon} size={13} />
                <span className="chat-chip__label">{addOn.label}</span>
              </button>
            ))}
          </div>
        )}
        <label className="sr-only" htmlFor="chatInput">
          {refining
            ? "Describe the change you want"
            : "Describe your idea or paste a prompt"}
        </label>
        <textarea
          id="chatInput"
          ref={input}
          rows={1}
          maxLength={100000}
          value={text}
          readOnly={recording}
          placeholder={
            recording
              ? "Listening…"
              : refining
                ? "Say what to change: shorter, more formal, add a deadline…"
                : "Describe it however it comes out, or paste a prompt…"
          }
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (!files.length || event.clipboardData.getData("text").trim())
              return;
            event.preventDefault();
            void addFiles(files);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <div className="chat-composer__bar">
          <button
            ref={plusButton}
            type="button"
            className="chat-plus"
            aria-label="Add files, fine-tuning or sources"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            disabled={recording}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="plus" size={18} />
          </button>
          {voice.phase === "recording" ? (
            <span className="chat-recording" role="status">
              <i aria-hidden="true" />
              {clock(voice.elapsed)}
              <span className="chat-recording__cap">
                {voice.elapsed >= MAX_RECORD_SECONDS - 30
                  ? "sends itself at 10:00"
                  : "/ 10:00"}
              </span>
            </span>
          ) : (
            <span
              className={`chat-composer__hint${notice ? " is-notice" : ""}`}
              role="status"
            >
              {hint}
            </span>
          )}
          {voice.phase === "recording" ? (
            <>
              <button
                type="button"
                className="chat-round chat-round--quiet"
                aria-label="Discard recording"
                onClick={() => voice.stop(false)}
              >
                <Icon name="x" size={17} />
              </button>
              <button
                type="button"
                className="chat-round chat-round--stop"
                aria-label="Stop and turn into text"
                onClick={() => voice.stop(true)}
              >
                <span className="chat-round__square" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="chat-round chat-round--quiet"
                aria-label="Speak your message (up to 10 minutes)"
                title={voice.available ? "Speak your message" : voice.message}
                disabled={
                  !voice.available || voice.phase === "sending" || !online
                }
                onClick={() => void voice.start()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
                </svg>
              </button>
              <button
                type="submit"
                className="chat-send"
                aria-label={refining ? "Revise prompt" : "Shape prompt"}
                disabled={!canSend}
              >
                <Icon name="arrow-up" size={18} />
              </button>
            </>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            void addFiles(event.target.files || []);
            event.target.value = "";
          }}
        />
      </form>
      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={plusButton}
        label="Add to your message"
        align="start"
        width={300}
        pointer
      >
        <div className="chat-menu">
          <MenuItem
            icon="upload"
            title="Add files or photos"
            detail={`Images and text files, up to ${MAX_ATTACHMENTS}`}
            onClick={() => {
              setMenuOpen(false);
              fileInput.current?.click();
            }}
          />
          <MenuItem
            icon="sliders"
            title="Fine-tune"
            detail="Tone, format, audience, what to avoid"
            onClick={() => {
              setMenuOpen(false);
              openSheet("tune");
            }}
          />
          <MenuItem
            icon="globe"
            title="Research and sources"
            detail="Web research, or a page to read first"
            onClick={() => {
              setMenuOpen(false);
              openSheet("research");
            }}
          />
          {showNewChat && (
            <MenuItem
              icon="refresh"
              title="New chat"
              detail="Clear this conversation and start over"
              onClick={() => {
                setMenuOpen(false);
                newChat();
              }}
            />
          )}
        </div>
      </Popover>
    </div>
  );
}

function MenuItem({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onClick(): void;
}) {
  return (
    <button type="button" className="chat-menu__item" onClick={onClick}>
      <span className="chat-menu__icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="chat-menu__text">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </button>
  );
}
