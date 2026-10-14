"use client";

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
  type InputHTMLAttributes,
} from "react";
import { Icon } from "./Icon";
import { IconButton } from "./Button";
import { cx } from "./cx";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  onClear?: () => void;
  enableSlashHotkey?: boolean;
  fieldClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      onClear,
      enableSlashHotkey = false,
      fieldClassName,
      className,
      value,
      defaultValue,
      onChange,
      onKeyDown,
      placeholder = "Search...",
      ...rest
    },
    ref,
  ) {
    const internalRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => internalRef.current!);

    const hasValue = Boolean(value || internalRef.current?.value);

    const handleClear = () => {
      if (internalRef.current) {
        internalRef.current.value = "";
        const syntheticEvent = {
          target: internalRef.current,
          currentTarget: internalRef.current,
        } as React.ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticEvent);
        internalRef.current.focus();
      }
      onClear?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      }
      onKeyDown?.(e);
    };

    useEffect(() => {
      if (!enableSlashHotkey) return;
      const onGlobalKeyDown = (e: KeyboardEvent) => {
        if (
          e.key === "/" &&
          !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
        ) {
          e.preventDefault();
          internalRef.current?.focus();
        }
      };
      window.addEventListener("keydown", onGlobalKeyDown);
      return () => window.removeEventListener("keydown", onGlobalKeyDown);
    }, [enableSlashHotkey]);

    return (
      <div className={cx("ui-control", fieldClassName)}>
        <span className="ui-adorn" aria-hidden="true">
          <Icon name="search" size={16} />
        </span>
        <input
          ref={internalRef}
          type="search"
          enterKeyHint="search"
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cx("ui-input", className)}
          {...rest}
        />
        {hasValue && (
          <IconButton
            size="sm"
            variant="ghost"
            icon="x"
            aria-label="Clear search"
            onClick={handleClear}
          />
        )}
      </div>
    );
  },
);
