"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange(value: string): void;
  searchable?: boolean;
  placeholder?: string;
  describedBy?: string;
};

export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  searchable,
  placeholder = "Choose an option",
  describedBy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const visible = normalized.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const currentLabel =
    normalized.find((option) => option.value === value)?.label ||
    value ||
    placeholder;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    if (searchable) search.current?.focus();
    else root.current?.querySelector<HTMLElement>('[role="option"]')?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open, searchable]);

  function choose(option: { value: string; label: string }) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  return (
    <div className="react-select" ref={root}>
      <span className="react-select-label">{label}</span>
      <div className={`search-select${open ? " is-open" : ""}`}>
        <button
          type="button"
          className="search-select-trigger"
          aria-label={label}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className="search-select-value">{currentLabel}</span>
          <span className="search-select-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <div
            className="search-select-panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                root.current?.querySelector("button")?.focus();
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, visible.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(0, index - 1));
              }
              if (event.key === "Enter" && visible[active]) {
                event.preventDefault();
                choose(visible[active]);
              }
            }}
          >
            {searchable && (
              <input
                className="search-select-input"
                ref={search}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder="Search options…"
                aria-label={`Search ${label.toLowerCase()}`}
              />
            )}
            <ul
              className="search-select-list"
              role="listbox"
              aria-label={label}
            >
              {visible.map((option, index) => (
                <li
                  className={`search-select-option${index === active ? " is-active" : ""}${value === option.value ? " is-selected" : ""}`}
                  role="option"
                  aria-selected={value === option.value}
                  tabIndex={-1}
                  key={option.value}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
            {!visible.length && (
              <span className="search-select-empty">No matches</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
