import type { Metadata } from "next";
import NotFoundView from "@/components/ui/NotFoundView";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <NotFoundView
      title="We can't find that page"
      primary={{ href: "/workspace", label: "Open your workspace" }}
      secondary={{ href: "/community", label: "Browse the community" }}
    >
      <p>
        The link may be mistyped, or the page may have moved. Nothing you saved
        has gone anywhere.
      </p>
    </NotFoundView>
  );
}
