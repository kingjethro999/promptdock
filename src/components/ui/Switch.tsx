"use client";

import React, {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: ReactNode;
  hint?: ReactNode;
  fieldClassName?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, hint, fieldClassName, className, id, disabled, checked, ...rest },
  ref,
) {
  const generatedId = useId();
  const fid = id ?? generatedId;
  const hintId = hint ? `${fid}-hint` : undefined;

  return (
    <div className={cx("ui-check-wrap", fieldClassName)}>
      <label
        htmlFor={fid}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "12px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
        }}
      >
        <input
          ref={ref}
          id={fid}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          className={cx("ui-switch", className)}
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

export default Switch;
