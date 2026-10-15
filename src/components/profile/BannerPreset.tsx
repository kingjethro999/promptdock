import { type PresetId, BANNER_PRESETS } from "@/lib/profile/banner-presets";

export function BannerPreset({ id }: { id: PresetId | string }) {
  const preset = BANNER_PRESETS.find((p) => p.id === id) ?? BANNER_PRESETS[0];

  return (
    <div
      className="banner-preset"
      data-preset={preset.id}
      style={{
        backgroundColor: preset.color,
      }}
      aria-hidden="true"
    >
      <div className="banner-preset-pattern" />
    </div>
  );
}

export default BannerPreset;
