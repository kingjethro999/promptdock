"use client";

type Props = {
  rect: { x: number; y: number; w: number; h: number } | null;
};

export function Spotlight({ rect }: Props) {
  const r =
    rect ??
    (typeof window !== "undefined"
      ? { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 }
      : { x: 0, y: 0, w: 0, h: 0 });

  return (
    <>
      {/* Invisible backdrop that swallows clicks */}
      <div className="tour-blocker" aria-hidden="true" />
      {/* Cutout hole with box-shadow scrim and accent border */}
      <div
        className="tour-hole"
        aria-hidden="true"
        data-empty={rect ? undefined : ""}
        style={{
          transform: `translate(${r.x}px, ${r.y}px)`,
          width: r.w,
          height: r.h,
        }}
      />
    </>
  );
}

export default Spotlight;
