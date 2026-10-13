"use client";

import React, { forwardRef, useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";
import { IconButton } from "./Button";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "endAdornment">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [shown, setShown] = useState(false);

    return (
      <TextField
        ref={ref}
        {...props}
        type={shown ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="none"
        endAdornment={
          <IconButton
            size="sm"
            variant="ghost"
            icon={shown ? "eye-off" : "eye"}
            aria-pressed={shown}
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => setShown((s) => !s)}
          />
        }
      />
    );
  },
);
