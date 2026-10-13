"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { cleanDisplayName, NAME_MESSAGES } from "@/lib/profile/validate";
import type { Draft } from "./types";

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  username: string;
  siteHost: string;
  onContinue(): void;
};

export function NameStep({
  draft,
  setDraft,
  username,
  siteHost,
  onContinue,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraft((d) => ({ ...d, displayName: val }));
    const result = cleanDisplayName(val);
    if (!result.ok) {
      setError(NAME_MESSAGES[result.reason]);
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = cleanDisplayName(draft.displayName);
    if (!result.ok) {
      setError(NAME_MESSAGES[result.reason]);
      return;
    }
    onContinue();
  };

  return (
    <form onSubmit={handleSubmit} className="setup__step-form">
      <div className="setup__step-header">
        <h1 tabIndex={-1} className="setup__step-title">
          What should we call you?
        </h1>
        <p className="setup__step-helper">
          This is the name on your profile in Community. It starts as your
          username, so you can keep it.
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
          placeholder={username}
        />

        <div className="setup__url-hint">
          <span>Your profile will live at </span>
          <code>
            {siteHost}/{username}
          </code>
        </div>
      </div>

      <div className="setup__actions">
        <div />
        <Button type="submit" variant="primary" size="md" disabled={!!error}>
          Continue
        </Button>
      </div>
    </form>
  );
}

export default NameStep;
