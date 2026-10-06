"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function AppDialog({
  className = "",
  label,
  close,
  children,
}: {
  className?: string;
  label: string;
  close(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`app-dialog ${className}`.trim()}
      aria-label={label}
      onClose={close}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      {children}
    </dialog>
  );
}
