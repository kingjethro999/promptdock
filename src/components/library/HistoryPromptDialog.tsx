"use client";

import { useState } from "react";
import AppDialog from "@/components/ui/AppDialog";
import Button from "@/components/ui/Button";
import type { SavedPrompt } from "@/lib/prompt/types";
import type { Revision } from "@/hooks/useLibrary";
import RevisionCompare from "./RevisionCompare";

export default function HistoryPromptDialog({
  history,
  close,
  restore,
}: {
  history: {
    prompt: SavedPrompt;
    revisions: Revision[];
    loading: boolean;
    error: string;
  };
  close(): void;
  restore(revision: Revision): Promise<void>;
}) {
  const [comparedRevisionId, setComparedRevisionId] = useState<number | null>(
    null,
  );
  const [restoreCandidate, setRestoreCandidate] = useState<Revision | null>(
    null,
  );

  return (
    <>
      <AppDialog
        className="history-dialog"
        label="Prompt history"
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
          ↶
        </span>
        <h2>Earlier versions</h2>
        <p>
          Restore one of the last 10 saved edits. Your current version will
          remain in history. Choose <strong>Compare</strong> on a version to
          preview exactly what a restore would change first.
        </p>
        <div className="history-list">
          {history.loading ? (
            <p>Loading earlier versions…</p>
          ) : history.error ? (
            <p role="alert">{history.error}</p>
          ) : history.revisions.length ? (
            history.revisions.map((revision) => (
              <div className="history-entry" key={revision.revisionId}>
                <div className="history-row">
                  <div>
                    <strong>{revision.name}</strong>
                    <small>
                      {new Date(revision.createdAt).toLocaleString()}
                    </small>
                    <p>{revision.data.task}</p>
                  </div>
                  <div className="history-actions">
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        setComparedRevisionId(
                          comparedRevisionId === revision.revisionId
                            ? null
                            : revision.revisionId,
                        )
                      }
                    >
                      {comparedRevisionId === revision.revisionId
                        ? "Hide diff"
                        : "Compare"}
                    </button>
                    <Button onClick={() => setRestoreCandidate(revision)}>
                      Restore
                    </Button>
                  </div>
                </div>
                {comparedRevisionId === revision.revisionId && (
                  <RevisionCompare
                    current={history.prompt}
                    previous={revision}
                  />
                )}
              </div>
            ))
          ) : (
            <p>
              No earlier versions yet. Edit and save this prompt to create one.
            </p>
          )}
        </div>
      </AppDialog>
      {restoreCandidate && (
        <AppDialog
          className="confirm-dialog"
          label="Restore version"
          close={() => setRestoreCandidate(null)}
        >
          <button
            className="dialog-close"
            type="button"
            aria-label="Close confirmation"
            onClick={() => setRestoreCandidate(null)}
          >
            ×
          </button>
          <span className="dialog-icon" aria-hidden="true">
            ✳
          </span>
          <span className="confirm-kicker">PLEASE CONFIRM</span>
          <h2>Restore this version?</h2>
          <p>
            Restore “{restoreCandidate.name}” from{" "}
            {new Date(restoreCandidate.createdAt).toLocaleString()}. Your
            current version will remain in history.
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setRestoreCandidate(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await restore(restoreCandidate);
                setRestoreCandidate(null);
              }}
            >
              Restore version
            </Button>
          </div>
        </AppDialog>
      )}
    </>
  );
}
