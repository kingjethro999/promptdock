"use client";

import { forwardRef, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { placeCard } from "@/lib/onboarding/target";
import type { Step } from "@/lib/onboarding/types";
import { TourMedia } from "./TourMedia";

type Props = {
  step: Step;
  index: number;
  total: number;
  rect: { x: number; y: number; w: number; h: number } | null;
  compact: boolean;
  last: boolean;
  onNext(): void;
  onBack(): void;
  onSkip(): void;
};

export const TourCard = forwardRef<HTMLDivElement, Props>(function TourCard(
  { step, index, total, rect, compact, last, onNext, onBack, onSkip },
  ref,
) {
  const tid = useId();
  const bid = useId();

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Estimate card size if not yet measured (fallback 360 x 240)
  const cardSize = { w: Math.min(360, vw - 32), h: 240 };
  const placement = placeCard(
    compact ? null : rect,
    cardSize,
    step.placement ?? "bottom",
    vw,
    vh,
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tid}
      aria-describedby={bid}
      className="tour-card"
      data-side={placement.side}
      data-compact={compact || undefined}
      style={{
        transform: compact
          ? undefined
          : `translate(${placement.x}px, ${placement.y}px)`,
      }}
    >
      <div className="tour-card__head">
        <p className="tour-progress">
          Step {index + 1} of {total}
        </p>
        <button
          type="button"
          aria-label="Close tour"
          className="tour-close-btn"
          onClick={onSkip}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <h2 id={tid} data-tour-title tabIndex={-1} className="tour-card__title">
        {step.title}
      </h2>

      <p id={bid} className="tour-card__body">
        {step.body}
      </p>

      {step.media && <TourMedia name={step.media} />}

      <div className="tour-actions">
        <div className="tour-dots" aria-hidden="true">
          {Array.from({ length: total }, (_, idx) => (
            <span
              key={idx}
              className={`tour-dot ${idx === index ? "is-active" : ""}`}
            />
          ))}
        </div>

        <div className="tour-actions__buttons">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            {index === 0 ? "Skip tour" : "Skip"}
          </Button>

          {index > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBack}
            >
              Back
            </Button>
          )}

          <Button type="button" variant="primary" size="sm" onClick={onNext}>
            {last ? (step.cta?.label ?? "Done") : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default TourCard;
