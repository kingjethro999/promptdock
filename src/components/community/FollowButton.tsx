"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";

type Props = {
  username: string;
  initialFollowing: boolean;
  initialCount: number;
};

export default function FollowButton({
  username,
  initialFollowing,
  initialCount,
}: Props) {
  const [s, setS] = useState({
    following: initialFollowing,
    count: Math.max(0, initialCount),
  });
  const busy = useRef(false);

  // Check ?intent=follow after login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") === "follow" && !initialFollowing) {
      params.delete("intent");
      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState(null, "", newUrl);
      void toggle();
    }
  }, [initialFollowing]);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const prev = s;
    const next = {
      following: !prev.following,
      count: Math.max(0, prev.count + (prev.following ? -1 : 1)),
    };
    setS(next);

    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: prev.following ? "DELETE" : "PUT",
      });

      if (res.status === 401) {
        setS(prev);
        window.location.href = `/auth?mode=login&next=/${username}?intent=follow`;
        return;
      }

      if (!res.ok) throw new Error();
      const d = await res.json();
      setS({
        following: Boolean(d.following),
        count: Math.max(0, Number(d.followerCount) || 0),
      });
    } catch {
      setS(prev);
    } finally {
      busy.current = false;
    }
  }

  return (
    <Button
      variant={s.following ? "secondary" : "primary"}
      onClick={toggle}
      aria-pressed={s.following}
    >
      {s.following ? "Following" : "Follow"} · {s.count}
    </Button>
  );
}
