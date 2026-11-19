import { SkeletonPage } from "@/components/ui/Skeleton";

export default function CommunityLoading() {
  return (
    <div className="community-container community-page">
      <SkeletonPage label="Loading the community" cards={9} />
    </div>
  );
}
