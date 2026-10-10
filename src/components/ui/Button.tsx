import type { ButtonHTMLAttributes, ReactNode } from "react";
import LiquidButton, { type LiquidButtonStatus } from "./LiquidButton";

type Variant = "primary" | "secondary" | "quiet" | "outline" | "accent";
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  children: ReactNode;
  loading?: boolean;
  status?: LiquidButtonStatus;
  liquid?: boolean;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  icon?: ReactNode;
};

const classes: Record<string, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  quiet: "quiet-button",
  outline: "outline-button",
  accent: "accent-button",
};

export default function Button({
  variant = "secondary",
  className = "",
  children,
  type = "button",
  loading,
  status,
  liquid = false,
  loadingText,
  successText,
  errorText,
  icon,
  disabled,
  ...props
}: Props) {
  // If liquid is explicitly requested OR if loading/status is provided, route through LiquidButton
  if (liquid || loading !== undefined || status !== undefined) {
    return (
      <LiquidButton
        variant={variant}
        type={type}
        loading={loading}
        status={status}
        loadingText={loadingText}
        successText={successText}
        errorText={errorText}
        icon={icon}
        disabled={disabled}
        className={`${classes[variant] || ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </LiquidButton>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${classes[variant] || ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
