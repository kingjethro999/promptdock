"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { CommitKey } from "./useCommitQueue";
import type { Draft } from "./types";

type Props = {
  draft: Draft;
  username: string;
  failed: Partial<Record<CommitKey, string>>;
  onRetry(key: CommitKey): void;
  onFinish(): Promise<boolean>;
  onAnyway(): void;
  onBack(): void;
};

export function DoneStep({
  username,
  failed,
  onRetry,
  onFinish,
  onAnyway,
  onBack,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const failureKeys = Object.keys(failed) as CommitKey[];

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const ok = await onFinish();
      if (!ok) {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="setup__step-form">
      <div className="setup__step-header">
        <div className="setup__done-badge" aria-hidden="true">
          <Icon name="check" size={24} />
        </div>
        <h1 tabIndex={-1} className="setup__step-title">
          Your profile is ready
        </h1>
        <p className="setup__step-helper">
          Nothing you have made is public. Prompts stay private until you choose
          to share them.
        </p>
      </div>

      {failureKeys.length > 0 && (
        <div className="setup__failures-box" role="alert">
          <p className="setup__failures-title">
            A few changes could not be saved:
          </p>
          <ul className="setup__failures-list">
            {failureKeys.map((key) => (
              <li key={key} className="setup__failure-item">
                <span>{failed[key]}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetry(key)}
                >
                  Retry
                </Button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="setup__failures-anyway"
            onClick={onAnyway}
          >
            Continue anyway
          </button>
        </div>
      )}

      <div className="setup__done-links">
        <Link
          href={`/${encodeURIComponent(username)}`}
          target="_blank"
          className="setup__preview-link"
        >
          <span>View my profile</span>
          <Icon name="external-link" size={14} />
        </Link>
      </div>

      <div className="setup__actions">
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Back
        </Button>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleFinish}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Go to my workspace"}
        </Button>
      </div>
    </div>
  );
}

export default DoneStep;
