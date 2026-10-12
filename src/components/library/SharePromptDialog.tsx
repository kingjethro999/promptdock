"use client";

import { useEffect, useState } from "react";
import AppDialog from "@/components/ui/AppDialog";
import Button from "@/components/ui/Button";
import type { SavedPrompt } from "@/lib/prompt/types";
import {
  effectiveVisibility,
  type Visibility,
  type Audience,
} from "@/lib/community/access";

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

export default function SharePromptDialog({
  prompt,
  close,
  setPrompt,
  onUpdated,
}: Props) {
  const [notice, setNotice] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt.visibility || (prompt.publicId ? "public" : "private"),
  );
  const [listed, setListed] = useState<boolean>(
    Boolean(prompt.listedInCommunity),
  );
  const [audience, setAudience] = useState<Audience>("public");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicLink =
    prompt.publicId && typeof window !== "undefined"
      ? `${window.location.origin}/p/${prompt.publicId}`
      : "";

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.communityAudience) {
          setAudience(data.communityAudience);
        }
      })
      .catch(() => {});
  }, []);

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

  async function updateVisibility(nextVis: Visibility, nextListed: boolean) {
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: nextVis,
          listed: nextVis === "private" ? false : nextListed,
        }),
      });

      if (!res.ok) throw new Error("Failed to update visibility");
      const data = await res.json();
      setVisibility(data.visibility);
      setListed(data.listedInCommunity);
      const updated: SavedPrompt = {
        ...prompt,
        publicId: data.publicId,
        visibility: data.visibility,
        listedInCommunity: data.listedInCommunity,
      };
      setPrompt(updated);
      onUpdated?.(updated);
      setNotice(
        data.visibility === "private"
          ? "Prompt is now private."
          : "Privacy updated. Share link is ready.",
      );
    } catch {
      setNotice("Could not update privacy. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const effective = effectiveVisibility(visibility, audience);
  let effectiveLabel = "";
  if (
    effective === "followers" &&
    visibility === "public" &&
    audience === "followers"
  ) {
    effectiveLabel =
      "Your profile audience is set to followers only, so link access is limited to followers.";
  }

  return (
    <AppDialog
      key="share"
      className="share-dialog prompt-privacy-dialog"
      label="Prompt Privacy & Sharing"
      close={close}
    >
      <button
        className="dialog-close"
        type="button"
        aria-label="Close"
        onClick={close}
      >
        ×
      </button>

      <div className="section-kicker">PROMPT PRIVACY</div>
      <h2>Privacy settings</h2>
      <p className="share-attribution">
        Configure access for <strong>{prompt.name}</strong>
      </p>

      {/* Visibility radio choice cards */}
      <div
        className="prompt-privacy-choices"
        role="radiogroup"
        aria-label="Prompt visibility"
      >
        <label
          className={`choice-card ${visibility === "private" ? "choice-card--selected" : ""}`}
        >
          <input
            type="radio"
            name="prompt-visibility"
            value="private"
            checked={visibility === "private"}
            disabled={saving}
            onChange={() => updateVisibility("private", false)}
          />
          <div className="choice-card__body">
            <strong>Private</strong>
            <p>Only you can view and use this prompt in your workspace.</p>
          </div>
        </label>

        <label
          className={`choice-card ${visibility === "public" ? "choice-card--selected" : ""}`}
        >
          <input
            type="radio"
            name="prompt-visibility"
            value="public"
            checked={visibility === "public"}
            disabled={saving}
            onChange={() => updateVisibility("public", listed)}
          />
          <div className="choice-card__body">
            <strong>Public</strong>
            <p>Anyone with the link can view and copy this prompt.</p>
          </div>
        </label>

        <label
          className={`choice-card ${visibility === "followers" ? "choice-card--selected" : ""}`}
        >
          <input
            type="radio"
            name="prompt-visibility"
            value="followers"
            checked={visibility === "followers"}
            disabled={saving}
            onChange={() => updateVisibility("followers", false)}
          />
          <div className="choice-card__body">
            <strong>Followers only</strong>
            <p>Only approved followers with the link can view.</p>
          </div>
        </label>
      </div>

      {effectiveLabel && (
        <p className="share-audience-warning">{effectiveLabel}</p>
      )}

      {/* Community listing toggle when public */}
      {visibility === "public" && (
        <div className="share-community-card">
          <div className="share-community-card__text">
            <strong>List in Community feed</strong>
            <p>
              Allow discovery in community search, tags, and creator profile.
            </p>
          </div>
          <input
            type="checkbox"
            checked={listed}
            disabled={saving}
            onChange={(e) => updateVisibility("public", e.target.checked)}
            className="share-community-card__checkbox"
          />
        </div>
      )}

      {/* Public / Followers link */}
      {publicLink && visibility !== "private" ? (
        <div className="share-link-group">
          <label htmlFor="reactShareLink">Shareable link</label>
          <div className="share-link-input-row">
            <input
              id="reactShareLink"
              type="text"
              readOnly
              aria-label="Prompt link"
              value={publicLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button variant="primary" onClick={copy}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : visibility === "private" ? (
        <div className="share-private-notice">
          <span>This prompt is private. Only you can access it.</span>
        </div>
      ) : null}

      {notice && (
        <p className="settings-feedback" role="status">
          {notice}
        </p>
      )}

      <div
        className="dialog-actions"
        style={{ justifyContent: "flex-end", marginTop: 20 }}
      >
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </div>
    </AppDialog>
  );
}
