import type { Metadata } from "next";
import PromptWorkspace from "@/components/builder/PromptWorkspace";

export const metadata: Metadata = {
  title: "Workspace",
  alternates: { canonical: "/workspace" },
  robots: { index: false },
};

export default function WorkspacePage() {
  return <PromptWorkspace />;
}
