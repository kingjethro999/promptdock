import { SkeletonPage } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="settings-view react-settings-page">
      <SkeletonPage label="Loading your settings" cards={4} />
    </div>
  );
}
