const refs = require("../referrals");

export type Inviter = {
  id?: string;
  username: string | null;
  email?: string;
  avatarUrl?: string | null;
};

export const referrals = {
  inviterFor: async (code: string): Promise<Inviter | null> => {
    return refs.inviterFor(code).catch(() => null);
  },
};
