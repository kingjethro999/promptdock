"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import ImageCropDialog from "@/components/community/ImageCropDialog";
import { decode } from "@/lib/community/image";
import { AvatarPicker } from "./AvatarPicker";
import { changed, type Draft } from "./types";

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  initial: Draft;
  username: string;
  onContinue(): void;
  onBack(): void;
};

export function PhotoStep({
  draft,
  setDraft,
  initial,
  username,
  onContinue,
  onBack,
}: Props) {
  const [cropTarget, setCropTarget] = useState<ImageBitmap | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handlePickFile = async (file: File) => {
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
      avatar: {
        kind: "image",
        source: "upload",
        id: crypto.randomUUID(),
        blob,
        previewUrl,
      },
    }));
  };

  const isChanged = changed("photo", draft, initial);

  return (
    <div className="setup__step-form">
      <div className="setup__step-header">
        <h1 tabIndex={-1} className="setup__step-title">
          Add a photo
        </h1>
        <p className="setup__step-helper">
          Upload one, or pick a generated avatar. A letter works too.
        </p>
      </div>

      {errorNotice && (
        <div className="setup__inline-error" role="alert">
          {errorNotice}
        </div>
      )}

      <AvatarPicker
        username={username}
        avatar={draft.avatar}
        onChange={(next) => setDraft((d) => ({ ...d, avatar: next }))}
        onPickFile={handlePickFile}
      />

      {cropTarget && (
        <ImageCropDialog
          bitmap={cropTarget}
          kind="avatar"
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

export default PhotoStep;
