"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Topic = "create" | "library" | "share" | "settings";
const topics: Topic[] = ["create", "library", "share", "settings"];

export default function HelpDialog({
  initialTopic,
  close,
}: {
  initialTopic: Topic;
  close(): void;
}) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);
  return (
    <div className="react-modal-backdrop help-backdrop" onClick={close}>
      <section
        className="app-dialog help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Close help"
          onClick={close}
        >
          ×
        </button>
        <span className="dialog-icon" aria-hidden="true">
          ✦
        </span>
        <h2 id="helpTitle">Find your flow</h2>
        <p>Start wherever you are. Pick a topic to see the next step.</p>
        <div className="help-tabs" role="tablist" aria-label="Help topics">
          {topics.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`helpTab${item}`}
              aria-controls={`helpPanel${item}`}
              aria-selected={topic === item}
              onClick={() => setTopic(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <section
          role="tabpanel"
          id={`helpPanel${topic}`}
          aria-labelledby={`helpTab${topic}`}
        >
          {topic === "create" && (
            <>
              <h3>From thought to prompt</h3>
              <ol>
                <li>
                  Write an idea as you would explain it to a friend. You can
                  also paste existing text or use the mic to dictate it.
                </li>
                <li>
                  Open <strong>Fine-tune your prompt</strong> if you know
                  details such as tone, audience, or format. Those details
                  travel with the same idea; you can leave them alone.
                </li>
                <li>
                  Generate a prompt, review what PromptDock focused on, then
                  edit, copy, run, or save it.
                </li>
              </ol>
              <Link className="help-go" href="/workspace" onClick={close}>
                Open idea to prompt ↗
              </Link>
            </>
          )}
          {topic === "library" && (
            <>
              <h3>Keep and improve your work</h3>
              <p>
                Save generated prompts or paste one you made elsewhere. Name it,
                add tags, search your collection, and sort it when it grows.
                Duplicate a private prompt to try a new direction. History lets
                you compare and restore earlier versions. Export JSON for a
                backup, or import one later.
              </p>
              <Link className="help-go" href="/library" onClick={close}>
                Open my library ↗
              </Link>
            </>
          )}
          {topic === "share" && (
            <>
              <h3>Two ways to share</h3>
              <p>
                <strong>Publish a prompt</strong> from your library when you
                want someone to view and copy that finished prompt. Anyone can
                open it; they need an account to save their own copy.
              </p>
              <p>
                <strong>Invite friends</strong> when you want to introduce them
                to PromptDock itself. Your invite has its own preview and link.
                When a friend signs up and verifies their email, your hourly AI
                and voice limits grow.
              </p>
              <Link
                className="help-go"
                href="/settings#invite-friends"
                onClick={close}
              >
                Get my invite link ↗
              </Link>
            </>
          )}
          {topic === "settings" && (
            <>
              <h3>Make the workspace yours</h3>
              <p>
                Settings shows your hourly usage and active sessions. You can
                use PromptDock’s default AI or save several of your own provider
                keys, including compatible custom endpoints, then switch the
                active one. Your username appears on shared prompts; legacy
                accounts can add one here.
              </p>
              <Link className="help-go" href="/settings" onClick={close}>
                Open settings ↗
              </Link>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
