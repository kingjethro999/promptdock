"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import ImageCropDialog from "@/components/community/ImageCropDialog";
import { decode } from "@/lib/community/image";
import { type PresetId, BANNER_PRESETS } from "@/lib/profile/banner-presets";
import { changed, type Draft } from "./types";

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  initial: Draft;
  onContinue(): void;
  onBack(): void;
};

export function BannerStep({
  draft,
  setDraft,
  initial,
  onContinue,
  onBack,
}: Props) {
  const [cropTarget, setCropTarget] = useState<ImageBitmap | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setErrorNotice(null);
      const bitmap = await decode(file);
      setCropTarget(bitmap);
    } catch {
      setErrorNotice("Could not open that image. Try a JPG, PNG or WebP.");
    }
  };

  const handleCropApply = (blob: Blob, previewUrl: string) => {
    setCropTarget(null);
    setDraft((d) => ({
      ...d,
      banner: {
        kind: "image",
        id: crypto.randomUUID(),
        blob,
        previewUrl,
      },
    }));
  };

  const selectPreset = (id: PresetId) => {
    setDraft((d) => ({
      ...d,
      banner: { kind: "preset", id },
    }));
  };

  const clearBanner = () => {
    setDraft((d) => ({
      ...d,
      banner: { kind: "none" },
    }));
  };

  const isChanged = changed("banner", draft, initial);

  return (
    <div className="setup__step-form">
      <div className="setup__step-header">
        <h1 tabIndex={-1} className="setup__step-title">
          Pick a cover
        </h1>
        <p className="setup__step-helper">A color works. So does a picture.</p>
      </div>

      {errorNotice && (
        <div className="setup__inline-error" role="alert">
          {errorNotice}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handlePickFile}
      />

      <div
        className="banner-step__grid"
        role="radiogroup"
        aria-label="Cover palette options"
      >
        {BANNER_PRESETS.map((p) => {
          const isSelected =
            draft.banner.kind === "preset" && draft.banner.id === p.id;

          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Color preset ${p.label}`}
              className={`banner-step__swatch ${isSelected ? "is-selected" : ""}`}
              style={{ backgroundColor: p.color }}
              onClick={() => selectPreset(p.id)}
            >
              <span className="banner-step__swatch-label">{p.label}</span>
              {isSelected && (
                <span className="banner-step__swatch-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          );
        })}

        {/* Upload custom tile */}
        <button
          type="button"
          className={`banner-step__upload-tile ${
            draft.banner.kind === "image" ? "is-selected" : ""
          }`}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload custom cover photo"
        >
          <Icon name="upload" size={18} />
          <span>Upload photo</span>
        </button>
      </div>

      {draft.banner.kind !== "none" && (
        <div className="banner-step__clear-row">
          <Button type="button" variant="ghost" size="sm" onClick={clearBanner}>
            <span>Clear cover</span>
          </Button>
        </div>
      )}

      {cropTarget && (
        <ImageCropDialog
          bitmap={cropTarget}
          kind="banner"
          onApply={handleCropApply}
          onCancel={() => {
            cropTarget.close?.();
            setCropTarget(null);
          }}
        />
      )}

      <div className="setup__actions">
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Back
        </Button>

        <Button
          type="button"
          variant={isChanged ? "primary" : "secondary"}
          size="md"
          onClick={onContinue}
        >
          {isChanged ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}

export default BannerStep;
