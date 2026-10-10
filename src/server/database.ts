import type { PromptData } from "@/lib/prompt/types";

const db = require("../database");

export type PublicPrompt = {
  publicId: string;
  name: string;
  data: PromptData;
  ownerUsername: string | null;
  updatedAt: string;
};

export const database = {
  getPublicPrompt: async (publicId: string): Promise<PublicPrompt | null> => {
    return db.getPublicPrompt(publicId).catch(() => null);
  },
};
