import { ChatSkeleton } from "@/components/builder/ChatSkeleton";

export default function WorkspaceLoading() {
  return (
    <div className="react-workspace-page builder-view">
      <ChatSkeleton label="Opening your workspace" />
    </div>
  );
}
