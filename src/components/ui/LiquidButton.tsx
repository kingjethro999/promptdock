"use client";

import React, {
  type ButtonHTMLAttributes,
  type ReactNode,
  useState,
  useRef,
} from "react";

export type LiquidInteractiveState =
  | "idle"
  | "hover"
  | "pressed"
  | "loading"
  | "success"
  | "error"
  | "unavailable";

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
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onKeyDown,
  onKeyUp,
  ...props
}: LiquidButtonProps) {
  const [internalState, setInternalState] =
    useState<LiquidInteractiveState>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Distinguish genuine unavailable state vs active processing state
  const isExternalLoading =
    externalLoading === true || externalStatus === "loading";
  const isUnavailable = Boolean(disabled && !isExternalLoading);

  const effectiveState: LiquidInteractiveState = isUnavailable
    ? "unavailable"
    : isExternalLoading
      ? "loading"
      : externalStatus === "success"
        ? "success"
        : externalStatus === "error"
          ? "error"
          : internalState;

  const isLoading = effectiveState === "loading";
  const isSuccess = effectiveState === "success";
  const isError = effectiveState === "error";

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent interaction when genuinely unavailable or currently processing
    if (isUnavailable || isLoading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (onClick) {
      onClick(event);
    }

    if (onAsyncClick) {
      setInternalState("loading");
      try {
        await onAsyncClick();
        setInternalState("success");
        setTimeout(() => {
          setInternalState("idle");
        }, 1800);
      } catch {
        setInternalState("error");
        setTimeout(() => {
          setInternalState("idle");
        }, 2200);
      }
    }
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "touch" || isUnavailable || isLoading) return;
    setInternalState("hover");
    if (onPointerEnter) onPointerEnter(e);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      buttonRef.current.style.removeProperty("--pointer-x");
      buttonRef.current.style.removeProperty("--pointer-y");
    }
    if (internalState === "hover" || internalState === "pressed") {
      setInternalState("idle");
    }
    if (onPointerLeave) onPointerLeave(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "touch" || isUnavailable || isLoading) return;
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      btn.style.setProperty("--pointer-x", x.toFixed(3));
      btn.style.setProperty("--pointer-y", y.toFixed(3));
    }
    if (onPointerMove) onPointerMove(e);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isUnavailable || isLoading) return;
    setInternalState("pressed");
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      btn.style.setProperty("--pointer-x", x.toFixed(3));
      btn.style.setProperty("--pointer-y", y.toFixed(3));
    }
    if (onPointerDown) onPointerDown(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isUnavailable || isLoading) return;
    if (e.pointerType !== "touch") {
      setInternalState("hover");
    } else {
      setInternalState("idle");
    }
    if (onPointerUp) onPointerUp(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isUnavailable || isLoading) return;
    if (e.key === "Enter" || e.key === " ") {
      setInternalState("pressed");
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isUnavailable || isLoading) return;
    if (e.key === "Enter" || e.key === " ") {
      setInternalState("idle");
    }
    if (onKeyUp) onKeyUp(e);
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={isUnavailable || isLoading}
      aria-busy={isLoading}
      data-liquid-state={effectiveState}
      data-status={
        isLoading
          ? "loading"
          : isSuccess
            ? "success"
            : isError
              ? "error"
              : "idle"
      }
      data-variant={variant}
      data-size={size}
      className={`liquid-button liquid-button--${variant} liquid-button--${size} is-${effectiveState} ${className}`.trim()}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      {...props}
    >
      {/* Liquid Wave Effect Layer */}
      <span className="liquid-button__canvas" aria-hidden="true">
        <span className="liquid-button__fluid">
          {/* Wave Layer 1 (Deep / Ambient phase) */}
          <svg
            className="liquid-wave liquid-wave--back"
            viewBox="0 0 900 60"
            preserveAspectRatio="none"
          >
            <path d="M0,25 C75,45 150,5 225,25 C300,45 375,5 450,25 C525,45 600,5 675,25 C750,45 825,5 900,25 L900,60 L0,60 Z" />
          </svg>
          {/* Wave Layer 2 (Luminous crest phase) */}
          <svg
            className="liquid-wave liquid-wave--front"
            viewBox="0 0 900 60"
            preserveAspectRatio="none"
          >
            <path d="M0,20 C80,2 160,38 240,20 C320,2 400,38 480,20 C560,2 640,38 720,20 C800,2 880,38 960,20 L960,60 L0,60 Z" />
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
