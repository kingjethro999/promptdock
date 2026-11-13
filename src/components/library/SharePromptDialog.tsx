"use client";

import { useEffect, useRef, useState } from "react";
import ModalFrame from "@/components/ui/ModalFrame";
import { Button, Icon } from "@/components/ui";
import type { SavedPrompt } from "@/lib/prompt/types";
import { effectiveVisibility, type Audience } from "@/lib/community/access";
import {
  VISIBILITY_STATES,
  visibilityState,
  type VisibilityState,
  type VisibilityStateId,
} from "@/lib/community/visibility-state";

type Props = {
  prompt: SavedPrompt;
  username: string | null;
  close(): void;
  publish(
    prompt: SavedPrompt,
    published: boolean,
  ): Promise<SavedPrompt | undefined>;
  setPrompt(prompt: SavedPrompt): void;
  onUpdated?(prompt: SavedPrompt): void;
};

type Finding = { id: string; label: string };

/** How exposed each state is; moving up the list asks for confirmation. */
const EXPOSURE: Record<VisibilityStateId, number> = {
  private: 0,
  followers: 1,
  link: 2,
  community: 3,
};

const CONFIRM_COPY: Record<VisibilityStateId, string> = {
  private: "",
  followers: "People who follow you will be able to open this prompt.",
  link: "Anyone with the link will be able to view and copy this prompt.",
  community:
    "This prompt will be public and listed in Community search, tags and on your profile.",
};

export default function SharePromptDialog({
  prompt,
  close,
  setPrompt,
  onUpdated,
}: Props) {
  const [current, setCurrent] = useState<VisibilityState>(() =>
    visibilityState(prompt),
  );
  // A more public choice waits here until it is confirmed.
  const [pending, setPending] = useState<VisibilityState | null>(null);
  const [warnings, setWarnings] = useState<Finding[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [audience, setAudience] = useState<Audience>("public");
  const [copied, setCopied] = useState(false);
  const latest = useRef(prompt);
  latest.current = prompt;
  const confirmButton = useRef<HTMLDivElement>(null);

  const publicLink =
    prompt.publicId && typeof window !== "undefined"
      ? `${window.location.origin}/p/${prompt.publicId}`
      : "";

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.communityAudience) setAudience(data.communityAudience);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pending)
      confirmButton.current?.querySelector<HTMLElement>("button")?.focus();
  }, [pending]);

  function show(next: SavedPrompt) {
    setPrompt(next);
    onUpdated?.(next);
  }

  async function apply(target: VisibilityState, acknowledgeWarn = false) {
    const before = latest.current;
    const previous = current;
    // Optimistic: the dialog and the library card change at once, and are
    // put back if the server refuses.
    setCurrent(target);
    setPending(null);
    setWarnings([]);
    setError("");
    setNotice("");
    setSaving(true);
    show({
      ...before,
      visibility: target.visibility,
      listedInCommunity: target.listed,
    });
    try {
      const res = await fetch(`/api/prompts/${before.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Never leave the dialog stuck on "Saving": give up and roll back.
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          visibility: target.visibility,
          listed: target.listed,
          acknowledgeWarn,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCurrent(previous);
        show(before);
        const findings: Finding[] = Array.isArray(data.findings)
          ? data.findings
          : [];
        const found = findings.map((item) => item.label).join(", ");
        if (data.error === "needs_ack" && findings.length) {
          setWarnings(findings);
          setPending(target);
        } else if (data.error === "blocked")
          setError(
            `This prompt looks like it contains ${found || "sensitive data"}. Remove it before sharing.`,
          );
        else if (res.status === 429)
          setError("Too many changes at once. Wait a moment and try again.");
        else setError("Could not update visibility. Nothing was changed.");
        return;
      }
      const saved = visibilityState(data);
      setCurrent(saved);
      show({
        ...before,
        publicId: data.publicId,
        visibility: data.visibility,
        listedInCommunity: data.listedInCommunity,
      });
      setNotice(
        saved.id === "private"
          ? "This prompt is now private."
          : `Saved: ${saved.label}.`,
      );
    } catch {
      setCurrent(previous);
      show(before);
      setError("Could not update visibility. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function choose(target: VisibilityState) {
    if (saving || target.id === current.id) return;
    setError("");
    setNotice("");
    setWarnings([]);
    if (EXPOSURE[target.id] > EXPOSURE[current.id]) setPending(target);
    else void apply(target);
  }

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(publicLink);
      } else {
        const input =
          document.querySelector<HTMLInputElement>("#reactShareLink");
        input?.select();
        if (!document.execCommand("copy")) throw new Error("Copy failed");
      }
      setCopied(true);
      setNotice("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      document.querySelector<HTMLInputElement>("#reactShareLink")?.select();
      setNotice("Select the link above to copy it.");
    }
  }

  const followersOnlyProfile =
    current.visibility === "public" &&
    effectiveVisibility(current.visibility, audience) === "followers";

  return (
    <ModalFrame
      title="Who can see this prompt"
      kicker="Visibility"
      description={<strong className="vis-prompt-name">{prompt.name}</strong>}
      className="visibility-modal"
      close={close}
      footer={
        <>
          <span
            className={`pd-modal__foot-note${error ? " is-error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {error || notice || (saving ? "Saving…" : "")}
          </span>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <fieldset className="vis-options" disabled={saving}>
        <legend className="sr-only">Prompt visibility</legend>
        {VISIBILITY_STATES.map((state) => {
          const checked = current.id === state.id;
          return (
            <label
              key={state.id}
              className="vis-option"
              data-checked={checked || undefined}
              data-pending={pending?.id === state.id || undefined}
            >
              <input
                type="radio"
                name="prompt-visibility"
                value={state.id}
                checked={checked}
                onChange={() => choose(state)}
                aria-describedby={`vis-hint-${state.id}`}
              />
              <span className="vis-option__icon" aria-hidden="true">
                <Icon name={state.icon} size={18} />
              </span>
              <span className="vis-option__text">
                <span className="vis-option__title">{state.label}</span>
                <span className="vis-option__hint" id={`vis-hint-${state.id}`}>
                  {state.hint}
                </span>
              </span>
              <span className="vis-option__radio" aria-hidden="true" />
            </label>
          );
        })}
      </fieldset>

      {pending && (
        <div className="vis-confirm" role="alert" ref={confirmButton}>
          <Icon name={warnings.length ? "alert" : "info"} size={18} />
          <div>
            <strong>
              {warnings.length
                ? `This prompt may contain ${warnings.map((item) => item.label).join(", ")}.`
                : `Make it “${pending.label}”?`}
            </strong>
            <p>
              {warnings.length
                ? `Check it before sharing. ${CONFIRM_COPY[pending.id]}`
                : CONFIRM_COPY[pending.id]}
            </p>
            <div className="vis-confirm__actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => apply(pending, warnings.length > 0)}
              >
                {warnings.length ? "Share anyway" : "Confirm"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPending(null);
                  setWarnings([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {followersOnlyProfile && (
        <p className="vis-note">
          Your profile is set to followers only, so this link only opens for
          people who follow you. Change it in Settings.
        </p>
      )}

      {publicLink && current.id !== "private" && (
        <div className="pd-field vis-link">
          <label className="pd-label" htmlFor="reactShareLink">
            Link
          </label>
          <div className="vis-link__row">
            <input
              id="reactShareLink"
              className="pd-input"
              type="text"
              readOnly
              value={publicLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              variant="secondary"
              onClick={copy}
              leadingIcon={copied ? "check" : "copy"}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
