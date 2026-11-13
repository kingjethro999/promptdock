"use client";

import { useEffect, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client/api";
import { cleanDisplayName, NAME_MESSAGES } from "@/lib/profile/validate";
import { validateUsername } from "@/lib/community/username";
import type { Draft } from "./types";

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  /** The handle the account has right now. */
  username: string;
  siteHost: string;
  /** Saves a new handle; resolves to an error message, or null on success. */
  saveHandle(next: string): Promise<string | null>;
  onContinue(): void;
};

type Availability = "same" | "checking" | "available" | "taken" | "unknown";

const HANDLE_RULE =
  "Use 3–30 lowercase letters or numbers. Hyphens and underscores can go in the middle.";

export function NameStep({
  draft,
  setDraft,
  username,
  siteHost,
  saveHandle,
  onContinue,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState(username);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("same");
  const [saving, setSaving] = useState(false);

  const wanted = handle.trim().toLowerCase();
  const unchanged = wanted === username.toLowerCase();

  // Live availability, checked a moment after typing stops.
  useEffect(() => {
    if (unchanged) return setAvailability("same");
    const valid = validateUsername(wanted);
    if (!valid.ok) {
      setAvailability("unknown");
      setHandleError(
        valid.reason === "reserved" ? "That handle is reserved." : HANDLE_RULE,
      );
      return;
    }
    setHandleError(null);
    setAvailability("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ available?: boolean; reason?: string }>(
          `/api/profile/handle?handle=${encodeURIComponent(wanted)}`,
        );
        if (cancelled) return;
        if (result.available) setAvailability("available");
        else if (result.reason === "taken") setAvailability("taken");
        else {
          setAvailability("unknown");
          setHandleError(
            result.reason === "reserved"
              ? "That handle is reserved."
              : HANDLE_RULE,
          );
        }
      } catch {
        // The final answer comes from the save itself.
        if (!cancelled) setAvailability("unknown");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, unchanged]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraft((d) => ({ ...d, displayName: val }));
    const result = cleanDisplayName(val);
    setError(result.ok ? null : NAME_MESSAGES[result.reason]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const result = cleanDisplayName(draft.displayName);
    if (!result.ok) {
      setError(NAME_MESSAGES[result.reason]);
      return;
    }
    if (!unchanged) {
      if (handleError || availability === "taken") return;
      setSaving(true);
      const problem = await saveHandle(wanted);
      setSaving(false);
      if (problem) {
        setHandleError(problem);
        return;
      }
    }
    onContinue();
  };

  const status =
    availability === "checking"
      ? "Checking availability…"
      : availability === "available"
        ? "Available"
        : availability === "same"
          ? "This is your current handle. You can keep it."
          : "";

  return (
    <form onSubmit={handleSubmit} className="setup__step-form" noValidate>
      <div className="setup__step-header">
        <h1 tabIndex={-1} className="setup__step-title">
          What should we call you?
        </h1>
        <p className="setup__step-helper">
          Your name and handle appear on your profile in Community. Both are
          filled in for you, so you can keep them.
        </p>
      </div>

      <div className="setup__field-group">
        <TextField
          id="profile-setup-display-name"
          label="Display name"
          value={draft.displayName}
          onChange={handleChange}
          error={error || undefined}
          autoFocus
          maxLength={60}
          autoComplete="name"
          placeholder={username}
        />

        <TextField
          id="profile-setup-handle"
          label="Handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
          error={
            handleError ||
            (availability === "taken" ? "That handle is taken." : undefined)
          }
          hint={status || HANDLE_RULE}
          maxLength={30}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="sr-only" role="status" aria-live="polite">
          {availability === "available" ? "Handle available" : ""}
        </p>

        <div className="setup__url-hint">
          <span>Your profile will live at </span>
          <code>
            {siteHost}/{wanted || username}
          </code>
        </div>
      </div>

      <div className="setup__actions">
        <div />
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={saving}
          loadingText="Saving…"
          disabled={
            !!error ||
            // A pending check does not block: the save checks again.
            (!unchanged && (!!handleError || availability === "taken"))
          }
        >
          Continue
        </Button>
      </div>
    </form>
  );
}

export default NameStep;
