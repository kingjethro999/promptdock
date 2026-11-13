"use client";

import { useId, type ReactNode } from "react";
import AppDialog from "./AppDialog";
import { IconButton } from "./Button";

/**
 * A workspace modal: a fixed header, a body that scrolls on its own, and a
 * footer that stays in reach. On phones it becomes a sheet from the bottom.
 */
export default function ModalFrame({
  title,
  description,
  kicker,
  close,
  footer,
  size = "md",
  className = "",
  children,
}: {
  title: string;
  description?: ReactNode;
  kicker?: string;
  close(): void;
  footer?: ReactNode;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <AppDialog
      className={`pd-modal pd-modal--${size} ${className}`.trim()}
      label={title}
      close={close}
    >
      <header className="pd-modal__head">
        <div className="pd-modal__titles">
          {kicker && <span className="pd-modal__kicker">{kicker}</span>}
          <h2 id={titleId}>{title}</h2>
          {description && (
            <p className="pd-modal__description">{description}</p>
          )}
        </div>
        <IconButton
          icon="x"
          aria-label="Close"
          variant="ghost"
          size="sm"
          className="pd-modal__close"
          onClick={close}
        />
      </header>
      <div className="pd-modal__body">{children}</div>
      {footer && <footer className="pd-modal__foot">{footer}</footer>}
    </AppDialog>
  );
}
