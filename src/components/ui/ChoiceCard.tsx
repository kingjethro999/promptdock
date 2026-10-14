"use client";

import React, { useId, type ReactNode } from "react";
import { cx } from "./cx";

export interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  badge,
  icon,
  disabled,
  className,
  id,
}: ChoiceCardProps) {
  const generatedId = useId();
  const fid = id ?? generatedId;
  const descId = description ? `${fid}-desc` : undefined;

  return (
    <label
      htmlFor={fid}
      className={cx("ui-choice-card", className)}
      data-checked={checked ? "true" : undefined}
      style={{
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        id={fid}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="ui-radio"
        aria-describedby={descId}
      />
      <div className="ui-choice-card__body">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {icon && <span>{icon}</span>}
            <span className="ui-choice-card__title">{title}</span>
          </div>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p id={descId} className="ui-choice-card__desc">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

export default ChoiceCard;
