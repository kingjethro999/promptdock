export type PublicCreator = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type CommunityPromptCard = {
  publicId: string;
  title: string;
  excerpt: string;
  tags: string[];
  listedAt: string;
  creator: PublicCreator;
};

export type PublicProfile = PublicCreator & {
  bio: string | null;
  bannerUrl: string | null;
  followerCount: number;
  isOwner: boolean;
  following?: boolean;
  communityAudience?: "public" | "followers";
};

export type CommunityCreatorCard = PublicCreator & {
  id: string;
  bio: string | null;
  followerCount: number;
  promptCount: number;
  following?: boolean;
  isOwner?: boolean;
};

export type Page = {
  items: CommunityPromptCard[];
  nextCursor: string | null;
};

export type Filters = {
  q?: string;
  tags?: string[];
  sort?: "new" | "old";
};
