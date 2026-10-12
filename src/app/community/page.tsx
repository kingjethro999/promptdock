import { getViewer } from "@/lib/community/viewer";
import {
  listCommunityPrompts,
  listCommunityTags,
  listCommunityCreators,
} from "@/lib/community/queries";
import CommunityExplorer from "@/components/community/CommunityExplorer";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const viewer = await getViewer();
  const [firstPage, availableTags, initialCreators] = await Promise.all([
    listCommunityPrompts({
      viewerId: viewer?.id ?? null,
      limit: 24,
    }),
    listCommunityTags(12),
    listCommunityCreators({
      viewerId: viewer?.id ?? null,
      limit: 24,
    }),
  ]);

  return (
    <div className="community-container">
      <header className="community-header">
        <div className="community-title-row">
          <div>
            <h1 className="community-heading">PromptDock Community</h1>
            <p className="community-subtitle">
              Discover prompts and creators shared by the PromptDock community.
              Copy prompts for any AI platform, explore creator profiles, or
              remix them into something new.
            </p>
          </div>
        </div>
      </header>

      <CommunityExplorer
        initialPrompts={firstPage}
        availableTags={availableTags}
        initialCreators={initialCreators}
      />
    </div>
  );
}
