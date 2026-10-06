"use client";

import Button from "@/components/ui/Button";

type Props = {
  questions: string[];
  answers: string[];
  busy: boolean;
  missingImages?: number;
  answer(index: number, value: string): void;
  finish(skip?: boolean): void;
};

export default function ClarificationPanel({
  questions,
  answers,
  busy,
  missingImages = 0,
  answer,
  finish,
}: Props) {
  return (
    <section
      className="clarification-card"
      aria-labelledby="clarificationHeading"
    >
      <div className="clarification-card-top">
        <span className="clarification-symbol" aria-hidden="true">
          ✦
        </span>
        <div>
          <div className="section-kicker">ONE QUICK CHECK</div>
          <h2 id="clarificationHeading">Help me get this right</h2>
        </div>
      </div>
      <p>
        These details could change the prompt. Answer what you know, or continue
        with open placeholders.
      </p>
      {missingImages > 0 && (
        <p role="alert">
          Reattach {missingImages} reference image
          {missingImages === 1 ? "" : "s"} above before finishing. Images are
          kept only on this device while the page is open.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          finish();
        }}
      >
        <div className="clarification-questions">
          {questions.map((question, index) => (
            <div className="clarification-question" key={question}>
              <label htmlFor={`clarification-${index}`}>{question}</label>
              <textarea
                id={`clarification-${index}`}
                rows={2}
                maxLength={5000}
                value={answers[index] || ""}
                placeholder="Whatever you know so far…"
                onChange={(event) => answer(index, event.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="clarification-actions">
          <Button
            variant="primary"
            type="submit"
            disabled={busy || missingImages > 0}
          >
            Shape my prompt ↗
          </Button>
          <Button
            disabled={busy || missingImages > 0}
            onClick={() => finish(true)}
          >
            Skip for now
          </Button>
        </div>
      </form>
    </section>
  );
}
