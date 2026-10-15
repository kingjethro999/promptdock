"use client";

import { useState } from "react";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { cleanBio } from "@/lib/profile/validate";
import { changed, type Draft } from "./types";

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  initial: Draft;
  onContinue(): void;
  onBack(): void;
};

export function BioStep({
  draft,
  setDraft,
  initial,
  onContinue,
  onBack,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft((d) => ({ ...d, bio: val }));
    const result = cleanBio(val);
    if (!result.ok) {
      setError("Bio cannot exceed 160 characters.");
    } else {
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const result = cleanBio(draft.bio);
    if (!result.ok) {
      setError("Bio cannot exceed 160 characters.");
      return;
    }
    onContinue();
  };

  const isChanged = changed("bio", draft, initial);
  const len = draft.bio.length;

  return (
    <form onSubmit={handleSubmit} className="setup__step-form">
      <div className="setup__step-header">
        <h1 tabIndex={-1} className="setup__step-title">
          Say a little about yourself
        </h1>
        <p className="setup__step-helper">
          One or two lines on what you build or care about.
        </p>
      </div>

      <div className="setup__field-group">
        <TextArea
          id="profile-setup-bio"
          label="Bio"
          value={draft.bio}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          error={error || undefined}
          autoFocus
          rows={3}
          maxLength={160}
          placeholder="Building prompts for developers and researchers..."
        />

        {len >= 120 && (
          <div className="setup__char-counter">
            <span>{160 - len} characters remaining</span>
          </div>
        )}
      </div>

      <div className="setup__actions">
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Back
        </Button>

        <Button
          type="submit"
          variant={isChanged ? "primary" : "secondary"}
          size="md"
          disabled={!!error}
        >
          {isChanged ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </form>
  );
}

export default BioStep;
