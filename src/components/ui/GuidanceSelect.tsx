"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  id: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string;
  onChange(value: string): void;
};

export default function GuidanceSelect({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const visible = ["", ...options].filter((option) =>
    (option || `Choose ${id}`).toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    if (options.length >= 6) search.current?.focus();
    else menu.current?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setQuery("");
    setActive(0);
    root.current?.querySelector<HTMLButtonElement>(".select-trigger")?.focus();
  }

  return (
    <div className="field">
      <label htmlFor={`${id}Trigger`}>{label}</label>
      <div className={`custom-select${open ? " open" : ""}`} ref={root}>
        <button
          id={`${id}Trigger`}
          className={`select-trigger${value ? " has-value" : ""}`}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}Options`}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span>{value || placeholder}</span>
          <span className="select-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
        <div
          id={`${id}Options`}
          className="select-menu"
          ref={menu}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              root.current
                ?.querySelector<HTMLButtonElement>(".select-trigger")
                ?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    visible.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            } else if (event.key === "Enter" && visible[active] !== undefined) {
              event.preventDefault();
              choose(visible[active]);
            }
          }}
        >
          {options.length >= 6 && (
            <input
              ref={search}
              className="select-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder={`Search ${id}…`}
              aria-label={`Search ${id} options`}
            />
          )}
          {visible.map((option, index) => (
            <button
              className="select-option"
              type="button"
              role="option"
              aria-selected={value === option}
              key={option}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span>{option || `Choose ${id}`}</span>
              <span className="select-check">
                {value === option ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
