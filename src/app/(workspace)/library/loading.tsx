import { SkeletonPage } from "@/components/ui/Skeleton";

export default function LibraryLoading() {
  return (
    <div className="react-library-page">
      <SkeletonPage label="Loading your library" cards={6} />
    </div>
  );
}
