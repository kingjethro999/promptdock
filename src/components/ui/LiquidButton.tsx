"use client";

import React, {
  type ButtonHTMLAttributes,
  type ReactNode,
  useState,
  useRef,
} from "react";

export type LiquidButtonStatus = "idle" | "loading" | "success" | "error";

export type LiquidButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  variant?: "primary" | "secondary" | "quiet" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  status?: LiquidButtonStatus;
  loadingText?: ReactNode;
  successText?: ReactNode;
  errorText?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  onAsyncClick?: () => Promise<void> | void;
};

export default function LiquidButton({
  variant = "primary",
  size = "md",
  loading: externalLoading,
  status: externalStatus,
  loadingText,
  successText,
  errorText,
  children,
  icon,
  className = "",
  disabled,
  onClick,
  onAsyncClick,
  type = "button",
  ...props
}: LiquidButtonProps) {
  const [internalStatus, setInternalStatus] =
    useState<LiquidButtonStatus>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync external loading or status
  const currentStatus: LiquidButtonStatus =
    externalStatus ??
    (externalLoading !== undefined
      ? externalLoading
        ? "loading"
        : "idle"
      : internalStatus);

  const isLoading = currentStatus === "loading";
  const isSuccess = currentStatus === "success";
  const isError = currentStatus === "error";
  const isDisabled = disabled || isLoading;

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }

    if (onClick) {
      onClick(event);
    }

    if (onAsyncClick) {
      setInternalStatus("loading");
      try {
        await onAsyncClick();
        setInternalStatus("success");
        setTimeout(() => {
          setInternalStatus("idle");
        }, 1800);
      } catch {
        setInternalStatus("error");
        setTimeout(() => {
          setInternalStatus("idle");
        }, 2200);
      }
    }
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      data-status={currentStatus}
      data-variant={variant}
      data-size={size}
      className={`liquid-button liquid-button--${variant} liquid-button--${size} ${
        isLoading ? "is-loading" : ""
      } ${isSuccess ? "is-success" : ""} ${isError ? "is-error" : ""} ${className}`.trim()}
      onClick={handleClick}
      {...props}
    >
      {/* Liquid Wave Effect Layer */}
      <span className="liquid-button__canvas" aria-hidden="true">
        <span className="liquid-button__fluid">
          {/* Wave Layer 1 (Deep/Ambient phase) */}
          <svg
            className="liquid-wave liquid-wave--back"
            viewBox="0 0 600 60"
            preserveAspectRatio="none"
          >
            <path d="M0,25 C75,45 150,5 225,25 C300,45 375,5 450,25 C525,45 600,10 675,25 L675,60 L0,60 Z" />
          </svg>
          {/* Wave Layer 2 (Luminous crest phase) */}
          <svg
            className="liquid-wave liquid-wave--front"
            viewBox="0 0 600 60"
            preserveAspectRatio="none"
          >
            <path d="M0,20 C80,2 160,38 240,20 C320,2 400,38 480,20 C560,2 640,38 720,20 L720,60 L0,60 Z" />
          </svg>
        </span>
      </span>

      {/* Button Content */}
      <span className="liquid-button__content">
        {isLoading && loadingText ? (
          <span className="liquid-button__label">{loadingText}</span>
        ) : isSuccess && successText ? (
          <span className="liquid-button__label">
            <span className="liquid-button__status-icon">✓</span> {successText}
          </span>
        ) : isError && errorText ? (
          <span className="liquid-button__label">
            <span className="liquid-button__status-icon">!</span> {errorText}
          </span>
        ) : (
          <>
            <span className="liquid-button__label">{children}</span>
            {icon && <span className="liquid-button__icon">{icon}</span>}
          </>
        )}
      </span>
    </button>
  );
}
