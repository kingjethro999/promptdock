import { SkeletonBlock } from "@/components/ui/Skeleton";

/** Stand-in for the conversation while it loads: one exchange's shape. */
export function ChatSkeleton({ label }: { label: string }) {
  return (
    <div className="pd-skel-chat" role="status">
      <span className="sr-only">{label}</span>
      <SkeletonBlock
        className="pd-skel-user"
        width="min(360px, 70%)"
        height={44}
        radius={18}
      />
      <SkeletonBlock width="64%" height={14} />
      <SkeletonBlock width="100%" height={180} radius={16} />
      <SkeletonBlock width="40%" height={14} />
      <SkeletonBlock width="86%" height={12} />
      <SkeletonBlock width="78%" height={12} />
    </div>
  );
}
