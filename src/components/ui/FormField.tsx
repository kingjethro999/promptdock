"use client";

import React, { useId, type ReactNode } from "react";
import { cx } from "./cx";

export interface FormFieldProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fid = id ?? generatedId;
  const hintId = hint && !error ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={cx("ui-field", className)}
      data-invalid={error ? "true" : undefined}
    >
      {label && (
        <label htmlFor={fid} className="ui-label">
          {label}
        </label>
      )}
      {children({
        id: fid,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
      })}
      {error ? (
        <p id={errId} className="ui-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="ui-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
