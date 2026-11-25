import type { Metadata } from "next";
import NotFoundView from "@/components/ui/NotFoundView";
import { getViewer } from "@/lib/community/viewer";

export const metadata: Metadata = {
  title: "This prompt isn't available",
  robots: { index: false },
};

/**
 * Deliberately the same for every reason: a prompt that is private, limited
 * to followers, deleted, or never existed. Saying which would tell a stranger
 * that a private prompt exists.
 */
export default async function SharedPromptUnavailable() {
  const viewer = await getViewer();
  return (
    <NotFoundView
      code="Link"
      title="This prompt isn't available"
      primary={
        viewer
          ? { href: "/community", label: "Browse the community" }
          : { href: "/auth?mode=login", label: "Sign in" }
      }
      secondary={
        viewer
          ? { href: "/library", label: "Go to your library" }
          : { href: "/community", label: "Browse the community" }
      }
    >
      <p>It could be one of a few things:</p>
      <ul>
        <li>The owner made it private, or took it down.</li>
        <li>
          It&apos;s shared with followers only, and you&apos;re not one yet.
        </li>
        <li>The link was cut off when it was copied.</li>
      </ul>
      <p>
        {viewer
          ? "Ask whoever sent it to check how it's shared."
          : "If it was sent to you as a follower, signing in may open it."}
      </p>
    </NotFoundView>
  );
}
