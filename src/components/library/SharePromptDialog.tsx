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
};

export default function SharePromptDialog({
  prompt,
  username,
  close,
  setPrompt,
}: Props) {
  const [notice, setNotice] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt.publicId ? "public" : "private",
  );
  const [listed, setListed] = useState(false);
  const [audience, setAudience] = useState<Audience>("public");
  const [saving, setSaving] = useState(false);

  const publicLink =
    prompt.publicId && typeof window !== "undefined"
      ? `${window.location.origin}/p/${prompt.publicId}`
      : "";

  useEffect(() => {
    // Fetch user audience setting
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
      setNotice("Link copied. Anyone with access can view this prompt.");
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
      setPrompt({
        ...prompt,
        publicId: data.publicId,
      });
      setNotice("Sharing settings updated.");
    } catch {
      setNotice("Could not update sharing settings. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const effective = effectiveVisibility(visibility, audience);
  let effectiveLabel = "";
  if (effective === "private") {
    effectiveLabel = "Private. Only you can view this prompt.";
  } else if (effective === "followers") {
    if (visibility === "public" && audience === "followers") {
      effectiveLabel =
        "Public, limited to followers by your profile audience cap.";
    } else {
      effectiveLabel =
        "Followers only. Visible to your followers with the link.";
    }
  } else {
    effectiveLabel = "Public. Anyone with the link can view.";
  }

  if (!prompt.publicId && visibility === "private") {
    return (
      <AppDialog
        key="publish"
        className="confirm-dialog"
        label="Publish prompt"
        close={close}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Close confirmation"
          onClick={close}
        >
          ×
        </button>
        <span className="dialog-icon" aria-hidden="true">
          ✳
        </span>
        <span className="confirm-kicker">PLEASE CONFIRM</span>
        <h2>Share this prompt?</h2>
        <p>
          Generate a shareable link for this prompt. You can choose whether to
          list it in Community discovery or keep it link-only.
        </p>
        <div className="dialog-actions">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await updateVisibility("public", false);
            }}
          >
            Create link
          </Button>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog
      key="share"
      className="share-dialog"
      label="Share prompt"
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
      <span className="dialog-icon" aria-hidden="true">
        ↗
      </span>
      <h2>Share this prompt</h2>
      {username && (
        <p className="share-attribution">
          {username} shared a prompt with you.
        </p>
      )}

      {/* Visibility control */}
      <div
        style={{
          margin: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600 }}>Visibility</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["private", "followers", "public"] as Visibility[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`community-btn${visibility === v ? " community-btn-primary" : ""}`}
              style={{ flex: 1, textTransform: "capitalize", minHeight: 40 }}
              onClick={() => {
                const nextListed = v === "private" ? false : listed;
                void updateVisibility(v, nextListed);
              }}
              disabled={saving}
            >
              {v}
            </button>
          ))}
        </div>

        <p
          style={{
            fontSize: 12,
            color: "var(--community-muted)",
            margin: "4px 0 0",
          }}
        >
          {effectiveLabel}
        </p>
      </div>

      {/* Community listing toggle */}
      <div
        style={{
          padding: "12px",
          background: "var(--community-tag-bg, #edf1eb)",
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: visibility === "private" ? 0.5 : 1,
        }}
      >
        <div>
          <strong style={{ fontSize: 13, display: "block" }}>
            List in Community
          </strong>
          <span style={{ fontSize: 12, color: "var(--community-muted)" }}>
            Allow discovery in the global community feed & profile.
          </span>
        </div>
        <input
          type="checkbox"
          checked={listed && visibility !== "private"}
          disabled={visibility === "private" || saving}
          onChange={(e) => {
            void updateVisibility(visibility, e.target.checked);
          }}
          style={{ width: 18, height: 18, cursor: "pointer" }}
        />
      </div>

      {publicLink && visibility !== "private" && (
        <>
          <label htmlFor="reactShareLink">Share link</label>
          <input
            id="reactShareLink"
            type="text"
            readOnly
            aria-label="Public prompt link"
            value={publicLink}
            onFocus={(event) => event.currentTarget.select()}
          />
        </>
      )}

      <div className="dialog-actions">
        {visibility !== "private" && (
          <Button
            onClick={() => {
              void updateVisibility("private", false);
            }}
          >
            Make private
          </Button>
        )}
        {publicLink && visibility !== "private" && (
          <Button variant="primary" onClick={copy}>
            Copy link
          </Button>
        )}
      </div>
      <p className="settings-feedback" role="status">
        {notice}
      </p>
    </AppDialog>
  );
}
