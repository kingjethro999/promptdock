"use client";

import React, { useRef, useId, type ChangeEvent, type ReactNode } from "react";
import { Button, type ButtonVariant, type ButtonSize } from "./Button";
import { type IconName } from "./Icon";

export interface FileButtonProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: IconName;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function FileButton({
  onFileSelect,
  accept,
  variant = "secondary",
  size = "md",
  leadingIcon,
  children,
  disabled,
  className,
}: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset value so selecting the same file again triggers change
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="ui-filebtn-input"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        variant={variant}
        size={size}
        leadingIcon={leadingIcon}
        disabled={disabled}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}

export default FileButton;
