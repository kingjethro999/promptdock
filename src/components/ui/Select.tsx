"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { cx } from "./cx";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

export interface SelectProps<T extends string = string> {
  label?: string;
  accessibleLabel?: string;
  value: T | null;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  id?: string;
  searchable?: boolean;
  className?: string;
}

import { usePopupPosition } from "./usePopupPosition";

export function Select<T extends string = string>({
  label,
  accessibleLabel,
  value,
  onChange,
  options,
  placeholder = "Select...",
  name,
  disabled,
  hint,
  error,
  id,
  searchable = false,
  className,
}: SelectProps<T>) {
  const uid = useId();
  const fid = id ?? uid;
  const listId = `${fid}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ s: "", t: 0 });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCoarse, setIsCoarse] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsCoarse(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)),
    );
  }, [options, searchable, searchQuery]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const pos = usePopupPosition(open, triggerRef, isCoarse);

  const openList = useCallback(() => {
    if (disabled) return;
    const initialIndex = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, initialIndex));
    setSearchQuery("");
    setOpen(true);
  }, [disabled, options, value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setSearchQuery("");
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (idx: number) => {
      const o = filteredOptions[idx];
      if (o && !o.disabled) {
        onChange(o.value);
        close();
      }
    },
    [filteredOptions, onChange, close],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      setActive((cur) => {
        if (!filteredOptions.length) return 0;
        for (let n = 1; n <= filteredOptions.length; n++) {
          const i =
            (cur + dir * n + filteredOptions.length * n) %
            filteredOptions.length;
          if (!filteredOptions[i].disabled) return i;
        }
        return cur;
      });
    },
    [filteredOptions],
  );

  // Focus search input on open
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  // Outside click closes
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open, close]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(filteredOptions.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        setActive(filteredOptions.map((o) => !o.disabled).lastIndexOf(true));
        break;
      case "Enter":
        e.preventDefault();
        commit(active);
        break;
      case " ":
        if (!searchable) {
          e.preventDefault();
          commit(active);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (
          !searchable &&
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          const now = Date.now();
          const t = typed.current;
          t.s =
            now - t.t > 500 ? e.key.toLowerCase() : t.s + e.key.toLowerCase();
          t.t = now;
          const i = filteredOptions.findIndex(
            (o) => !o.disabled && o.label.toLowerCase().startsWith(t.s),
          );
          if (i >= 0) setActive(i);
        }
    }
  }

  const errId = error ? `${fid}-error` : undefined;
  const hintId = hint && !error ? `${fid}-hint` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  const popupContent = (
    <>
      {searchable && (
        <div style={{ padding: "6px 8px 4px" }}>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Type to filter..."
            className="ui-input"
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid var(--ui-border)",
              borderRadius: "calc(var(--ui-radius) - 3px)",
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
      {filteredOptions.length === 0 ? (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            color: "var(--ui-placeholder)",
            fontSize: "13px",
          }}
        >
          No options found
        </div>
      ) : (
        filteredOptions.map((o, i) => (
          <div
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            data-active={i === active || undefined}
            className="ui-option"
            onPointerMove={() => setActive(i)}
            onClick={() => commit(i)}
          >
            <span>
              {o.label}
              {o.description && <small>{o.description}</small>}
            </span>
            {o.value === value && <Icon name="check" size={16} />}
          </div>
        ))
      )}
    </>
  );

  return (
    <div
      className={cx("ui-field", className)}
      data-invalid={error ? "true" : undefined}
    >
      {label && (
        <span id={`${fid}-label`} className="ui-label">
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        id={fid}
        type="button"
        role="combobox"
        className="ui-control ui-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={accessibleLabel}
        aria-labelledby={label ? `${fid}-label ${fid}` : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span
          className={selected ? "ui-select__value" : "ui-select__placeholder"}
        >
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className="ui-select__caret"
          data-open={open ? "true" : undefined}
        />
      </button>

      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {error ? (
        <p id={errId} className="ui-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="ui-hint">
          {hint}
        </p>
      ) : null}

      {open &&
        mounted &&
        createPortal(
          isCoarse ? (
            <>
              <div className="ui-sheet-backdrop" onClick={() => close()} />
              <div
                ref={popRef}
                id={listId}
                role="listbox"
                aria-labelledby={label ? `${fid}-label` : undefined}
                className="ui-sheet-content"
                data-ui-layer="true"
              >
                <div className="ui-sheet-handle" />
                {label && (
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "16px",
                      marginBottom: "12px",
                      color: "var(--ui-fg)",
                    }}
                  >
                    {label}
                  </div>
                )}
                {popupContent}
              </div>
            </>
          ) : (
            pos && (
              <div
                ref={popRef}
                id={listId}
                role="listbox"
                aria-labelledby={label ? `${fid}-label` : undefined}
                className="ui-popup"
                data-ui-layer="true"
                style={{
                  left: pos.left,
                  width: pos.width,
                  top: pos.top,
                  bottom: pos.bottom,
                  maxHeight: pos.maxH,
                }}
              >
                {popupContent}
              </div>
            )
          ),
          document.body,
        )}
    </div>
  );
}

export default Select;
