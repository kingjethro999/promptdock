"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import {
  type StyleId,
  AVATAR_STYLES,
  DEFAULT_STYLE,
} from "@/lib/profile/avatar-styles";
import {
  type Generated,
  generateSet,
  prefetchAvatarGen,
} from "@/lib/profile/avatar-gen";
import { paletteHex, USE_BRAND_BACKGROUND } from "@/lib/profile/avatar-palette";
import type { Draft } from "./types";

export const PREAPPLY_GENERATED = true;

type Props = {
  username: string;
  avatar: Draft["avatar"];
  onChange(next: Draft["avatar"]): void;
  onPickFile?(file: File): void;
};

export function AvatarPicker({
  username,
  avatar,
  onChange,
  onPickFile,
}: Props) {
  const [style, setStyle] = useState<StyleId>(DEFAULT_STYLE);
  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<Generated[] | "loading" | "error">(
    "loading",
  );
  const [notice, setNotice] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const applied = useRef(false);
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const gridId = useId();

  // Prefetch generator chunk on mount
  useEffect(() => {
    prefetchAvatarGen(DEFAULT_STYLE);
  }, []);

  // Generate the 8 tiles whenever style, round, or username changes
  useEffect(() => {
    let live = true;
    setTiles("loading");

    generateSet(
      style,
      username,
      round,
      USE_BRAND_BACKGROUND ? paletteHex() : [],
    )
      .then((set) => {
        if (!live) return;
        setTiles(set);

        if (PREAPPLY_GENERATED && round === 0 && !applied.current) {
          applied.current = true;
          if (avatar.kind === "none") {
            onChange({
              kind: "generated",
              id: `${set[0].style}:${set[0].seed}`,
              ...set[0],
            });
            setNotice("Generated avatar applied.");
          }
        }
      })
      .catch(() => {
        if (live) setTiles("error");
      });

    return () => {
      live = false;
    };
  }, [style, round, username]);

  const selectTile = (g: Generated) => {
    onChange({
      kind: "generated",
      id: `${g.style}:${g.seed}`,
      ...g,
    });
    setNotice("Avatar selected.");
  };

  const handleShuffle = () => {
    setRound((r) => r + 1);
    setNotice("Showing next avatar options.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && onPickFile) {
      onPickFile(file);
    }
  };

  const handleRemove = () => {
    onChange({ kind: "none" });
    setNotice("Using initial letter fallback.");
  };

  // Keyboard navigation for radio group
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!Array.isArray(tiles)) return;
    let nextIndex = index;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % tiles.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + tiles.length) % tiles.length;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectTile(tiles[index]);
      return;
    }

    if (nextIndex !== index) {
      const target =
        radioGroupRef.current?.querySelectorAll<HTMLButtonElement>(
          "[role='radio']",
        )[nextIndex];
      target?.focus();
      selectTile(tiles[nextIndex]);
    }
  };

  return (
    <div className="avatar-picker">
      {/* Live polite accessibility notice */}
      <div className="sr-only" aria-live="polite">
        {notice}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Action bar: Upload & Remove */}
      <div className="avatar-picker__actions">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon name="upload" size={15} />
          <span>Upload photo</span>
        </Button>

        {avatar.kind !== "none" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            <span>Use a letter instead</span>
          </Button>
        )}
      </div>

      {/* Style selector chips & Shuffle */}
      <div className="avatar-picker__toolbar">
        <div
          className="avatar-picker__styles"
          role="tablist"
          aria-label="Avatar style"
        >
          {AVATAR_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={style === s.id}
              className={`avatar-picker__style-chip ${style === s.id ? "is-active" : ""}`}
              onClick={() => setStyle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="avatar-picker__shuffle-btn"
          aria-label="Show different options"
          onClick={handleShuffle}
          disabled={tiles === "loading"}
        >
          <Icon name="shuffle" size={16} />
        </button>
      </div>

      {/* 8-Tile Radiogroup */}
      <div
        ref={radioGroupRef}
        id={gridId}
        role="radiogroup"
        aria-label="Pick an avatar"
        className="avatar-picker__grid"
      >
        {tiles === "loading" &&
          Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="avatar-picker__tile avatar-picker__tile--skeleton"
            />
          ))}

        {tiles === "error" && (
          <div className="avatar-picker__error">
            <p>Generated avatars are temporarily unavailable.</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRound((r) => r)}
            >
              Retry
            </Button>
          </div>
        )}

        {Array.isArray(tiles) &&
          tiles.map((tile, i) => {
            const isSelected =
              avatar.kind === "generated" &&
              avatar.style === tile.style &&
              avatar.seed === tile.seed;

            return (
              <button
                key={tile.seed}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Avatar option ${i + 1} of 8`}
                className={`avatar-picker__tile ${isSelected ? "is-selected" : ""}`}
                onClick={() => selectTile(tile)}
                onKeyDown={(e) => handleKeyDown(e, i)}
              >
                <img
                  src={tile.uri}
                  alt=""
                  className="avatar-picker__tile-img"
                />
                {isSelected && (
                  <span className="avatar-picker__tile-check">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default AvatarPicker;
