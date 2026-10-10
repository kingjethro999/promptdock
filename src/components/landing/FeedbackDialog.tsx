"use client";

import { useState } from "react";
import SearchSelect from "@/components/ui/SearchSelect";
import Button from "@/components/ui/Button";
import { json } from "@/lib/client/api";
import { useScrollLock } from "@/components/scroll/useScrollLock";

export default function FeedbackDialog({
  label = "Send feedback",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [kind, setKind] = useState("bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await json("/api/feedback", "POST", { kind, message, contactEmail });
      setNotice("Thanks. Your feedback was sent.");
      setMessage("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not send feedback.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={className}
        type="button"
        data-testid="open-modal"
        onClick={() => {
          setOpen(true);
          setNotice("");
        }}
      >
        {label}
      </button>
      {open && (
        <div className="react-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="react-modal scroll-region"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedbackTitle"
            data-lenis-prevent
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="react-modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <span className="section-kicker">HELP SHAPE PROMPTDOCK</span>
            <h2 id="feedbackTitle">What did you notice?</h2>
            <form onSubmit={send}>
              <SearchSelect
                label="Feedback type"
                value={kind}
                options={[
                  { value: "bug", label: "Something broke" },
                  { value: "idea", label: "I have an idea" },
                  { value: "other", label: "Something else" },
                ]}
                onChange={setKind}
              />
              <label className="react-field">
                <span>Your message</span>
                <textarea
                  required
                  maxLength={10000}
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <label className="react-field">
                <span>Email, optional</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </label>
              {notice && (
                <p role="status" className="settings-feedback">
                  {notice}
                </p>
              )}
              <Button
                variant="primary"
                type="submit"
                disabled={busy}
                loading={busy}
                loadingText="Sending feedback…"
              >
                Send feedback
              </Button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
