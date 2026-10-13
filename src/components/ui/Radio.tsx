"use client";

import React, { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: ReactNode;
  fieldClassName?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, hint, fieldClassName, className, id, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const fid = id ?? generatedId;
  const hintId = hint ? `${fid}-hint` : undefined;

  return (
    <div className={cx("ui-radio-wrap", fieldClassName)}>
      <label
        htmlFor={fid}
        style={{
          display: "inline-flex",
          alignItems: "flex-start",
          gap: "10px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
        }}
      >
        <input
          ref={ref}
          id={fid}
          type="radio"
          disabled={disabled}
          className={cx("ui-radio", className)}
          aria-describedby={hintId}
          {...rest}
        />
        {(label || hint) && (
          <div style={{ display: "grid", gap: "2px" }}>
            {label && (
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: disabled ? "var(--ui-placeholder)" : "var(--ui-fg)",
                  lineHeight: "20px",
                }}
              >
                {label}
              </span>
            )}
            {hint && (
              <span id={hintId} className="ui-hint">
                {hint}
              </span>
            )}
          </div>
        )}
      </label>
    </div>
  );
});

export interface RadioGroupProps {
  label?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  error?: string | null;
}

export function RadioGroup({
  label,
  name,
  value,
  children,
  className,
  error,
}: RadioGroupProps) {
  const generatedId = useId();

  return (
    <div
      role="radiogroup"
      data-name={name}
      data-value={value}
      aria-labelledby={label ? `${generatedId}-label` : undefined}
      className={cx("ui-field", className)}
    >
      {label && (
        <span id={`${generatedId}-label`} className="ui-label">
          {label}
        </span>
      )}
      <div style={{ display: "grid", gap: "10px" }}>{children}</div>
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default Radio;
