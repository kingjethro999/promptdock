"use client";

import { useEffect, useId, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ChoiceCard from "@/components/ui/ChoiceCard";
import ModalFrame from "@/components/ui/ModalFrame";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { usePromptBuilder } from "@/hooks/usePromptBuilder";
import type { useSavePrompt } from "@/hooks/useSavePrompt";
import type { Clarification, PromptInterpretation } from "@/lib/prompt/types";
import { guidanceFields } from "@/lib/prompt/types";
import type { PromptBaseline } from "@/stores/prompt-builder";
import { GuidanceFields } from "./FineTunePanel";
import ChatComposer, { type AddOn, type ChatDoc } from "./ChatComposer";
import { ChatSkeleton } from "./ChatSkeleton";
import PromptDiffPanel from "./PromptDiffPanel";
import SaveSplitButton from "./SaveSplitButton";

type Builder = ReturnType<typeof usePromptBuilder>;

type Turn = {
  id: string;
  /** What the person typed, shown as their message. */
  text: string;
  /** Whether this message revised the prompt above it. */
  refine?: boolean;
  /** Names of files and images sent with the message. */
  files?: string[];
  questions?: Clarification[];
  skipped?: boolean;
  result?: {
    prompt: string;
    interpretation?: PromptInterpretation;
    baseline: PromptBaseline | null;
  };
  error?: string;
};

const STORE_KEY = "promptdock.chat.v1";
const MAX_TURNS = 20;

function readTurns(): Turn[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Turn[]).slice(-MAX_TURNS) : [];
  } catch {
    return [];
  }
}

function writeTurns(turns: Turn[]) {
  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify(turns.slice(-MAX_TURNS)),
    );
  } catch {
    // The conversation still works; it just won't survive a reload.
  }
}

/** Text files ride along inside the message, clearly fenced and labelled. */
function withAttachments(message: string, docs: ChatDoc[]) {
  if (!docs.length) return message;
  let room = 90_000 - message.length;
  const parts = [message];
  for (const doc of docs) {
    if (room <= 200) break;
    const body = doc.text.slice(0, room - 120);
    parts.push(
      `Attached file "${doc.name}"${doc.truncated || body.length < doc.text.length ? " (first part only)" : ""}:\n"""\n${body}\n"""`,
    );
    room -= body.length + 120;
  }
  return parts.join("\n\n");
}

/** Ask the model to revise the prompt on screen instead of starting over. */
function refineRequest(prompt: string, change: string) {
  return `Here is a prompt I already use:\n\n${prompt}\n\nRevise it with this change, keeping everything else that still applies: ${change}`;
}

export default function ChatWorkspace({
  builder,
  save,
  onOpenDetails,
}: {
  builder: Builder;
  save: ReturnType<typeof useSavePrompt>;
  onOpenDetails(): void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [refine, setRefine] = useState(true);
  const [sheet, setSheet] = useState<"tune" | "research" | null>(null);
  const [docs, setDocs] = useState<ChatDoc[]>([]);
  const awaiting = useRef<{ id: string; revision: number } | null>(null);
  const lastPending = useRef<Clarification[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Stored turns load after mount so the server render matches; nothing is
  // written back until they have, or an empty first render would wipe them.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTurns(readTurns());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) writeTurns(turns);
  }, [turns, hydrated]);

  // A prompt shaped in the classic layout carries over as the first message.
  useEffect(() => {
    if (
      !hydrated ||
      turns.length ||
      awaiting.current ||
      builder.busy ||
      !builder.ready ||
      !builder.prompt
    )
      return;
    setTurns([
      {
        id: crypto.randomUUID(),
        text: builder.documentSource || builder.idea || "Your prompt",
        result: {
          prompt: builder.prompt,
          interpretation: builder.result?.interpretation,
          baseline: builder.baseline,
        },
      },
    ]);
  }, [
    hydrated,
    turns.length,
    builder.busy,
    builder.ready,
    builder.prompt,
    builder.documentSource,
    builder.idea,
    builder.result,
    builder.baseline,
  ]);

  const latestResult = [...turns].reverse().find((turn) => turn.result);
  const hasPrompt = Boolean(latestResult && builder.ready && builder.prompt);
  const refining = hasPrompt && refine;

  // Remember the questions and answers so they stay in the transcript.
  useEffect(() => {
    if (builder.pending)
      lastPending.current = builder.pending.questions.map(
        (question, index) => ({
          question,
          answer: builder.pending?.answers[index] || "",
        }),
      );
  }, [builder.pending]);

  // Settle the message we sent once the builder has an answer for it.
  useEffect(() => {
    const wait = awaiting.current;
    if (!wait || builder.busy || builder.pending) return;
    const id = wait.id;
    awaiting.current = null;
    const questions = lastPending.current;
    lastPending.current = null;
    if (builder.documentRevision !== wait.revision && builder.ready) {
      const result = {
        prompt: builder.prompt,
        interpretation: builder.result?.interpretation,
        baseline: builder.baseline,
      };
      setTurns((all) =>
        all.map((turn) =>
          turn.id === id
            ? { ...turn, result, questions: questions || turn.questions }
            : turn,
        ),
      );
      // Images went with that message; the next one starts clean.
      for (let index = builder.attachments.length - 1; index >= 0; index -= 1)
        builder.removeImage(index);
    } else {
      setTurns((all) =>
        all.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                questions: questions || turn.questions,
                error: builder.status || "That did not work. Try again.",
              }
            : turn,
        ),
      );
    }
  }, [
    builder.busy,
    builder.pending,
    builder.documentRevision,
    builder.ready,
    builder.prompt,
    builder.result,
    builder.baseline,
    builder.status,
  ]);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "end",
    });
  }, [turns.length, builder.pending, builder.busy]);

  function send(override?: string) {
    if (builder.busy || builder.pending) return;
    const message = (override ?? text).trim();
    const images = builder.attachments.length;
    if (message.length < 4 && !images && !docs.length) return;
    const typed =
      message ||
      (docs.length
        ? "Turn the attached file into a detailed, reusable prompt."
        : "Turn the attached image into a detailed, reusable prompt.");
    const withFiles = withAttachments(typed, docs);
    const asRefine = refining && Boolean(latestResult?.result);
    builder.setIdea(
      asRefine && latestResult?.result
        ? refineRequest(builder.prompt || latestResult.result.prompt, withFiles)
        : withFiles,
    );
    const id = crypto.randomUUID();
    setTurns((all) => [
      ...all,
      {
        id,
        text:
          message ||
          (images
            ? "Turn the attached image into a prompt."
            : "Turn the attached file into a prompt."),
        refine: asRefine,
        files: [
          ...builder.attachments.map((item) => item.file.name),
          ...docs.map((doc) => doc.name),
        ],
      },
    ]);
    awaiting.current = { id, revision: builder.documentRevision };
    setText("");
    setDocs([]);
    void builder.generate();
  }

  function retry(turn: Turn) {
    setText(turn.text);
    setRefine(Boolean(turn.refine));
    setTurns((all) => all.filter((item) => item.id !== turn.id));
    document.getElementById("chatInput")?.focus();
  }

  function newChat() {
    setDocs([]);
    awaiting.current = null;
    lastPending.current = null;
    builder.clear();
    setTurns([]);
    setText("");
    setRefine(true);
    document.getElementById("chatInput")?.focus();
  }

  function suggest(detail: string) {
    setRefine(true);
    setText(`Add this: ${detail}`);
    document.getElementById("chatInput")?.focus();
  }

  const tuned = guidanceFields.filter((field) =>
    (builder.guidance[field] || "").trim(),
  );
  const addOns: AddOn[] = [
    ...(tuned.length
      ? [
          {
            key: "tune",
            label: `Fine-tuned: ${tuned.length} setting${tuned.length === 1 ? "" : "s"}`,
            icon: "sliders" as IconName,
            open: () => setSheet("tune"),
          },
        ]
      : []),
    ...(builder.researchMode !== "auto" || builder.referenceUrl.trim()
      ? [
          {
            key: "research",
            label:
              builder.referenceUrl.trim() && builder.researchMode !== "off"
                ? `Source: ${hostOf(builder.referenceUrl)}`
                : builder.researchMode === "on"
                  ? "Web research on"
                  : "No web research",
            icon: "globe" as IconName,
            open: () => setSheet("research"),
          },
        ]
      : []),
  ];

  return (
    <div className="chat-workspace">
      <div className="chat-log" aria-live="polite">
        {!hydrated && <ChatSkeleton label="Loading your conversation" />}
        {hydrated && turns.length === 0 && !builder.busy && (
          <div className="chat-empty">
            <h2>What do you want the AI to do?</h2>
            <p>
              Paste a prompt you already use, or describe the job the way you
              would to a colleague. If something is unclear I will ask before
              writing anything, and I will show you what changed.
            </p>
          </div>
        )}

        {turns.map((turn, index) => {
          const live = index === turns.length - 1;
          return (
            <div className="chat-turn" key={turn.id}>
              <div className="chat-msg chat-msg--user">
                {turn.refine && (
                  <span className="chat-msg__tag">Revise the prompt</span>
                )}
                <p>{turn.text}</p>
                {turn.files && turn.files.length > 0 && (
                  <ul className="chat-msg__files">
                    {turn.files.map((name, position) => (
                      <li key={`${name}-${position}`}>
                        <Icon name="file" size={12} />
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {live && builder.pending && !turn.result ? (
                <ClarifyMessage builder={builder} />
              ) : (
                turn.questions &&
                turn.questions.length > 0 && (
                  <AnsweredQuestions questions={turn.questions} />
                )
              )}

              {live && builder.busy && !turn.result && (
                <div className="chat-msg chat-msg--assistant chat-thinking">
                  <span className="chat-thinking__dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span role="status">{builder.status}</span>
                </div>
              )}

              {turn.error && (
                <div className="chat-msg chat-msg--assistant chat-error">
                  <p>{turn.error}</p>
                  <Button size="sm" onClick={() => retry(turn)}>
                    <Icon name="refresh" size={14} /> Edit and resend
                  </Button>
                </div>
              )}

              {turn.result && (
                <ResultMessage
                  result={turn.result}
                  latest={turn === latestResult}
                  save={save}
                  onOpenDetails={onOpenDetails}
                  suggest={suggest}
                />
              )}
            </div>
          );
        })}
        <div ref={endRef} className="chat-end" />
      </div>

      <ChatComposer
        builder={builder}
        text={text}
        setText={setText}
        docs={docs}
        setDocs={setDocs}
        refining={refining}
        hasPrompt={hasPrompt}
        refine={refine}
        setRefine={setRefine}
        addOns={addOns}
        showNewChat={turns.length > 0}
        onSend={send}
        openSheet={setSheet}
        newChat={newChat}
      />

      {sheet === "tune" && (
        <ModalFrame
          title="Fine-tune"
          description="Only fill in what you care about. Your next message uses these; the prompt on screen stays as it is."
          close={() => setSheet(null)}
          size="lg"
          footer={
            <Button variant="primary" onClick={() => setSheet(null)}>
              Done
            </Button>
          }
        >
          <div className="chat-sheet-fields">
            <GuidanceFields
              guidance={builder.guidance}
              update={builder.updateGuidance}
            />
          </div>
        </ModalFrame>
      )}
      {sheet === "research" && (
        <ResearchSheet builder={builder} close={() => setSheet(null)} />
      )}
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    return url.trim().slice(0, 32);
  }
}

function ResearchSheet({
  builder,
  close,
}: {
  builder: Builder;
  close(): void;
}) {
  const options: {
    id: "auto" | "on" | "off";
    icon: IconName;
    title: string;
    detail: string;
  }[] = [
    {
      id: "auto",
      icon: "sparkles",
      title: "When it helps",
      detail: "Searches the web only for current or factual topics.",
    },
    {
      id: "on",
      icon: "globe",
      title: "Always",
      detail: "Every request looks up recent sources first.",
    },
    {
      id: "off",
      icon: "lock",
      title: "Never",
      detail: "Uses only what you write. Faster.",
    },
  ];
  return (
    <ModalFrame
      title="Research and sources"
      description="Decide whether PromptDock checks the web before writing, and point it at a page to read."
      close={close}
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <fieldset className="chat-research">
        <legend>Web research</legend>
        {options.map((option) => (
          <ChoiceCard
            key={option.id}
            name="chatResearch"
            value={option.id}
            checked={builder.researchMode === option.id}
            onChange={() => builder.setResearchMode(option.id)}
            icon={<Icon name={option.icon} size={16} />}
            title={option.title}
            description={option.detail}
          />
        ))}
      </fieldset>
      <div className="field chat-research__url">
        <label htmlFor="chatReferenceUrl">
          Page to read first <span className="optional">optional</span>
        </label>
        <input
          id="chatReferenceUrl"
          type="url"
          value={builder.referenceUrl}
          placeholder="e.g. https://docs.stripe.com/api"
          onChange={(event) => builder.setReferenceUrl(event.target.value)}
        />
      </div>
    </ModalFrame>
  );
}

function ClarifyMessage({ builder }: { builder: Builder }) {
  const pending = builder.pending!;
  const missing = Math.max(
    0,
    (pending.imageCount || 0) - builder.attachments.length,
  );
  const answered = pending.answers.some((answer) => answer.trim());
  return (
    <div className="chat-msg chat-msg--assistant chat-clarify">
      <p className="chat-lead">
        {pending.questions.length === 1
          ? "One thing would change the result. Answer it, or skip and I will make a sensible guess."
          : `${pending.questions.length} things would change the result. Answer what you can and skip the rest.`}
      </p>
      <ol>
        {pending.questions.map((question, index) => (
          <li key={question}>
            <label htmlFor={`chatAnswer${index}`}>{question}</label>
            <textarea
              id={`chatAnswer${index}`}
              rows={2}
              value={pending.answers[index] || ""}
              placeholder="Your answer"
              onChange={(event) => builder.answer(index, event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !builder.busy
                ) {
                  event.preventDefault();
                  void builder.finishClarification();
                }
              }}
            />
          </li>
        ))}
      </ol>
      {missing > 0 && (
        <p className="chat-note">
          Reattach {missing} image{missing === 1 ? "" : "s"} with the + button
          before continuing.
        </p>
      )}
      <div className="chat-actions">
        <Button
          variant="primary"
          size="sm"
          disabled={builder.busy || !answered}
          onClick={() => void builder.finishClarification()}
        >
          Continue
        </Button>
        <Button
          size="sm"
          disabled={builder.busy}
          onClick={() => void builder.finishClarification(true)}
        >
          Skip, use your best guess
        </Button>
      </div>
    </div>
  );
}

function AnsweredQuestions({ questions }: { questions: Clarification[] }) {
  return (
    <div className="chat-msg chat-msg--assistant chat-answered">
      <p className="chat-lead">I asked:</p>
      <dl>
        {questions.map((item) => (
          <div key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer.trim() || "Skipped, used a sensible default"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ResultMessage({
  result,
  latest,
  save,
  onOpenDetails,
  suggest,
}: {
  result: NonNullable<Turn["result"]>;
  latest: boolean;
  save: ReturnType<typeof useSavePrompt>;
  onOpenDetails(): void;
  suggest(detail: string): void;
}) {
  const [copied, setCopied] = useState("");
  const checksId = useId();
  const interpretation = result.interpretation;
  const changes = interpretation?.changes ?? [];
  const checks = interpretation?.checks ?? [];
  const open = interpretation?.missingDetails ?? [];

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(done);
    } catch {
      setCopied("Copy unavailable. Select the text and copy it.");
    }
  }

  return (
    <div className="chat-msg chat-msg--assistant chat-result">
      {interpretation?.goal && (
        <p className="chat-lead">{interpretation.goal}</p>
      )}

      <div className="chat-prompt">
        <div className="chat-prompt__bar">
          <span>Your prompt</span>
          <span className="chat-prompt__count">
            {result.prompt.trim().split(/\s+/).length} words
          </span>
          <button
            type="button"
            className="chat-prompt__copy"
            onClick={() => void copy(result.prompt, "Prompt copied.")}
          >
            <Icon name="copy" size={14} /> Copy
          </button>
        </div>
        <pre tabIndex={0}>{result.prompt}</pre>
      </div>

      {latest && (
        <div className="chat-actions">
          <SaveSplitButton save={save} onOpenDetails={onOpenDetails} />
        </div>
      )}

      {changes.length > 0 && (
        <section className="chat-section">
          <h3>Why this works better</h3>
          <ol className="chat-upgrades">
            {changes.map((change, index) => (
              <li key={`${change.what}-${index}`}>
                <strong>{change.what}</strong>
                {change.why && <span>{change.why}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <PromptDiffPanel baseline={result.baseline} prompt={result.prompt} />

      {checks.length > 0 && (
        <section className="chat-section" aria-labelledby={checksId}>
          <div className="chat-section__head">
            <h3 id={checksId}>How to check the answer you get</h3>
            <button
              type="button"
              className="chat-link"
              onClick={() =>
                void copy(
                  [
                    "Review your answer against this checklist. For each item, say yes or no and point to where it is met:",
                    ...checks.map((check) => `- [ ] ${check}`),
                  ].join("\n"),
                  "Checklist copied. Paste it after the AI's answer to have it check its own work.",
                )
              }
            >
              <Icon name="copy" size={13} /> Copy checklist
            </button>
          </div>
          <ul className="chat-checks">
            {checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </section>
      )}

      {latest && open.length > 0 && (
        <section className="chat-section">
          <h3>Still yours to decide</h3>
          <p className="chat-note">Tap one to add it to the prompt.</p>
          <div className="chat-suggestions">
            {open.map((detail) => (
              <button
                type="button"
                key={detail}
                className="chat-suggestion"
                onClick={() => suggest(detail)}
              >
                <Icon name="plus" size={13} /> {detail}
              </button>
            ))}
          </div>
        </section>
      )}

      {copied && (
        <p className="chat-note" role="status">
          {copied}
        </p>
      )}
    </div>
  );
}
