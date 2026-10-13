"use client";

import React, {
  forwardRef,
  useId,
  useRef,
  useImperativeHandle,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  autoGrow?: boolean;
  fieldClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    {
      label,
      hint,
      error,
      autoGrow = false,
      fieldClassName,
      id,
      className,
      maxLength,
      value,
      defaultValue,
      onChange,
      disabled,
      rows = 3,
      ...rest
    },
    ref,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => internalRef.current!);

    const generatedId = useId();
    const fid = id ?? generatedId;
    const hintId = hint && !error ? `${fid}-hint` : undefined;
    const errId = error ? `${fid}-error` : undefined;
    const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

    const currentLen =
      typeof value === "string"
        ? value.length
        : typeof defaultValue === "string"
          ? defaultValue.length
          : internalRef.current?.value.length || 0;

    const showCounter =
      maxLength && maxLength > 0 && currentLen >= maxLength * 0.75;

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoGrow && internalRef.current) {
        internalRef.current.style.height = "auto";
        internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
      }
      onChange?.(e);
    };

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
          className="ui-control ui-textarea-control"
          data-disabled={disabled ? "true" : undefined}
          data-invalid={error ? "true" : undefined}
        >
          <textarea
            ref={internalRef}
            id={fid}
            rows={rows}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            onChange={handleInput}
            className={cx("ui-textarea", className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
        </div>
        {showCounter && (
          <div className="ui-counter">
            {currentLen} / {maxLength}
          </div>
        )}
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
