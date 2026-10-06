import { headers } from "next/headers";
import { cache } from "react";

type User = { id: string; email: string; username: string | null };
const auth = require("../../auth") as {
  currentUser(request: { headers: { cookie: string } }): Promise<User | null>;
};
const admin = require("../../admin-server") as {
  isAdmin(user: User | null): boolean;
};

export const session = cache(
  async (): Promise<{
    user: User;
    admin: boolean;
  } | null> => {
    const incoming = await headers();
    try {
      const user = await auth.currentUser({
        headers: { cookie: incoming.get("cookie") || "" },
      });
      return user ? { user, admin: admin.isAdmin(user) } : null;
    } catch {
      return null;
    }
  },
);
