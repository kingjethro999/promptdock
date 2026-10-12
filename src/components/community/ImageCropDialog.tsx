"use client";

import { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";
import {
  type ImageKind,
  type Crop,
  ASPECT,
  cropRect,
  encode,
} from "@/lib/community/image";

type Props = {
  bitmap: ImageBitmap;
  kind: ImageKind;
  onApply(blob: Blob, previewUrl: string): void;
  onCancel(): void;
};

export default function ImageCropDialog({
  bitmap,
  kind,
  onApply,
  onCancel,
}: Props) {
  const aspect = ASPECT[kind];
  const [crop, setCrop] = useState<Crop>({
    zoom: 1,
    cx: bitmap.width / 2,
    cy: bitmap.height / 2,
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Wheel to zoom
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setCrop((prev) => ({
      ...prev,
      zoom: Math.min(4, Math.max(1, prev.zoom + delta)),
    }));
  }

  // Pointer drag to pan
  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      cx: crop.cx,
      cy: crop.cy,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = bitmap.width / (rect.width * crop.zoom);
    const scaleY = bitmap.height / (rect.height * crop.zoom);

    const dx = (e.clientX - dragStart.current.x) * scaleX;
    const dy = (e.clientY - dragStart.current.y) * scaleY;

    setCrop((prev) => ({
      ...prev,
      cx: Math.max(0, Math.min(bitmap.width, dragStart.current.cx - dx)),
      cy: Math.max(0, Math.min(bitmap.height, dragStart.current.cy - dy)),
    }));
  }

  function handlePointerUp() {
    setDragging(false);
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    const step = 20 / crop.zoom;
    if (e.key === "ArrowLeft") {
      setCrop((c) => ({ ...c, cx: Math.max(0, c.cx - step) }));
    } else if (e.key === "ArrowRight") {
      setCrop((c) => ({ ...c, cx: Math.min(bitmap.width, c.cx + step) }));
    } else if (e.key === "ArrowUp") {
      setCrop((c) => ({ ...c, cy: Math.max(0, c.cy - step) }));
    } else if (e.key === "ArrowDown") {
      setCrop((c) => ({ ...c, cy: Math.min(bitmap.height, c.cy + step) }));
    } else if (e.key === "+" || e.key === "=") {
      setCrop((c) => ({ ...c, zoom: Math.min(4, c.zoom + 0.1) }));
    } else if (e.key === "-") {
      setCrop((c) => ({ ...c, zoom: Math.max(1, c.zoom - 0.1) }));
    }
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const rect = cropRect(bitmap.width, bitmap.height, aspect, crop);
      const blob = await encode(bitmap, rect, kind);
      const previewUrl = URL.createObjectURL(blob);
      onApply(blob, previewUrl);
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  // Draw preview canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = cropRect(bitmap.width, bitmap.height, aspect, crop);
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [bitmap, aspect, crop]);

  return (
    <div
      className="crop-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust ${kind}`}
    >
      <div className="crop-modal" onKeyDown={handleKeyDown} tabIndex={0}>
        <div className="crop-modal-header">
          <h3>Adjust {kind === "avatar" ? "profile photo" : "cover image"}</h3>
          <p>Drag to reposition, or use the slider to zoom in.</p>
        </div>

        <div
          ref={containerRef}
          className={`crop-canvas-wrapper ${kind === "avatar" ? "crop-avatar-shape" : "crop-banner-shape"}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: dragging ? "grabbing" : "grab" }}
        >
          <canvas ref={canvasRef} className="crop-canvas" />
        </div>

        <div className="crop-controls">
          <label className="crop-zoom-label">
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={crop.zoom}
              onChange={(e) =>
                setCrop((prev) => ({
                  ...prev,
                  zoom: Number.parseFloat(e.target.value),
                }))
              }
              className="crop-zoom-slider"
            />
          </label>
        </div>

        <div className="crop-actions">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={busy}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
