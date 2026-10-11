import { getViewer } from "@/lib/community/viewer";
import {
  listCommunityPrompts,
  listCommunityTags,
} from "@/lib/community/queries";
import PromptGrid from "@/components/community/PromptGrid";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const viewer = await getViewer();
  const [firstPage, availableTags] = await Promise.all([
    listCommunityPrompts({
      viewerId: viewer?.id ?? null,
      limit: 24,
    }),
    listCommunityTags(12),
  ]);

  return (
    <div className="community-container">
      <header className="community-header">
        <div className="community-title-row">
          <div>
            <h1 className="community-heading">PromptDock Community</h1>
            <p className="community-subtitle">
              Discover prompts shared by the PromptDock community. Copy them for
              any AI platform, save them to your library, or remix them into
              something new.
            </p>
          </div>
        </div>
      </header>

      <PromptGrid
        initial={firstPage}
        availableTags={availableTags}
        showFilters={true}
      />
    </div>
  );
}
