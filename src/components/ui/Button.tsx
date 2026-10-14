"use client";

import React, {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link, { type LinkProps } from "next/link";
import { Icon, type IconName } from "./Icon";
import LiquidButton, { type LiquidButtonStatus } from "./LiquidButton";
import { cx } from "./cx";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "outline" | "accent" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  status?: LiquidButtonStatus;
  liquid?: boolean;
  onAsyncClick?: () => Promise<void> | void;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  icon?: ReactNode;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

export interface IconButtonProps extends Omit<
  ButtonProps,
  "children" | "leadingIcon" | "trailingIcon"
> {
  icon: IconName;
  "aria-label": string; // strictly required for accessibility
  size?: ButtonSize;
}

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  icon?: ReactNode;
  children: ReactNode;
  target?: string;
  rel?: string;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "ui-btn--primary primary-button",
  secondary: "ui-btn--secondary secondary-button",
  quiet: "ui-btn--ghost quiet-button",
  ghost: "ui-btn--ghost quiet-button",
  outline: "ui-btn--outline outline-button",
  accent: "ui-btn--accent accent-button",
  danger: "ui-btn--danger",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "ui-btn--sm",
  md: "ui-btn--md",
  lg: "ui-btn--lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      type = "button",
      loading,
      status = "idle",
      liquid,
      onAsyncClick,
      loadingText,
      successText,
      errorText,
      icon,
      leadingIcon,
      trailingIcon,
      className,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    // If liquid is explicitly true OR unless explicitly set to false,
    // action buttons route through LiquidButton to provide the signature wave hover,
    // pointer tracking, and after-click loading/status animation.
    const isAction =
      variant === "primary" ||
      variant === "accent" ||
      variant === "danger" ||
      loading !== undefined ||
      status !== "idle" ||
      onAsyncClick !== undefined;

    const shouldUseLiquid =
      liquid === true ||
      (liquid !== false && (isAction || liquid === undefined));

    const content = (
      <>
        {leadingIcon && (
          <Icon name={leadingIcon} size={size === "sm" ? 14 : 18} />
        )}
        {children}
        {icon && <span className="liquid-button__icon">{icon}</span>}
        {trailingIcon && (
          <Icon name={trailingIcon} size={size === "sm" ? 14 : 18} />
        )}
      </>
    );

    if (shouldUseLiquid) {
      return (
        <LiquidButton
          type={type}
          variant={variant}
          size={size}
          loading={loading}
          status={status}
          onAsyncClick={onAsyncClick}
          loadingText={loadingText}
          successText={successText}
          errorText={errorText}
          disabled={disabled || loading}
          className={cx(
            "ui-btn",
            variantClassMap[variant],
            sizeClassMap[size],
            className,
          )}
          {...rest}
        >
          {content}
        </LiquidButton>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading ? "true" : undefined}
        className={cx(
          "ui-btn",
          variantClassMap[variant],
          sizeClassMap[size],
          className,
        )}
        {...rest}
      >
        {content}
      </button>
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      size = "md",
      variant = "ghost",
      className,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cx(
          "ui-iconbtn",
          variantClassMap[variant],
          size === "sm" && "ui-iconbtn--sm",
          className,
        )}
        {...rest}
      >
        <Icon name={icon} size={size === "sm" ? 16 : 18} />
      </button>
    );
  },
);

export function LinkButton({
  variant = "secondary",
  size = "md",
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cx(
        "ui-btn",
        "ui-linkbtn",
        variantClassMap[variant],
        sizeClassMap[size],
        className,
      )}
      {...rest}
    >
      {leadingIcon && (
        <Icon name={leadingIcon} size={size === "sm" ? 14 : 18} />
      )}
      {children}
      {trailingIcon && (
        <Icon name={trailingIcon} size={size === "sm" ? 14 : 18} />
      )}
    </Link>
  );
}

export default Button;
