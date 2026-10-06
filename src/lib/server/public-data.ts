import type { PromptData } from "@/lib/prompt/types";

export type PublicPrompt = {
  publicId: string;
  name: string;
  data: PromptData;
  ownerUsername: string | null;
  updatedAt: string;
};

export type SiteUpdate = {
  id: string;
  title: string;
  summary: string;
  body: string;
  version: string;
  date: string;
  publishedAt?: string;
};

const database = require("../../database") as {
  getPublicPrompt(id: string): Promise<PublicPrompt | null>;
  listPublishedUpdates(): Promise<SiteUpdate[]>;
};
const staticUpdates = require("../../updates") as SiteUpdate[];

export async function publicPrompt(id: string): Promise<PublicPrompt | null> {
  return database.getPublicPrompt(id).catch(() => null);
}

export async function siteUpdates(): Promise<SiteUpdate[]> {
  const databaseUpdates = await database.listPublishedUpdates().catch(() => []);
  return [
    ...databaseUpdates,
    ...staticUpdates.filter(
      (item) => !databaseUpdates.some((saved) => saved.id === item.id),
    ),
  ];
}
