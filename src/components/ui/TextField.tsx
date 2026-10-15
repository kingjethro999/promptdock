"use client";

import React, {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label?: string;
  hint?: string;
  error?: string | null;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  fieldClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      label,
      hint,
      error,
      startAdornment,
      endAdornment,
      fieldClassName,
      id,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const fid = id ?? generatedId;
    const hintId = hint && !error ? `${fid}-hint` : undefined;
    const errId = error ? `${fid}-error` : undefined;
    const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

    return (
      <div
        className={cx("ui-field", fieldClassName)}
        data-invalid={error ? "true" : undefined}
      >
        {label && (
          <label htmlFor={fid} className="ui-label">
            {label}
          </label>
        )}
        <div
          className="ui-control"
          data-disabled={disabled ? "true" : undefined}
          data-invalid={error ? "true" : undefined}
        >
          {startAdornment && <span className="ui-adorn">{startAdornment}</span>}
          <input
            ref={ref}
            id={fid}
            disabled={disabled}
            className={cx("ui-input", className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {endAdornment && <span className="ui-adorn">{endAdornment}</span>}
        </div>
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
  },
);
