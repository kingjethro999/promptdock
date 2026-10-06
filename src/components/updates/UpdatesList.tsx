"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { SiteUpdate } from "@/lib/server/public-data";

export default function UpdatesList({ updates }: { updates: SiteUpdate[] }) {
  const [read, setRead] = useState<string[]>([]);
  const [canMarkRead, setCanMarkRead] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api<{ readIds: string[]; canMarkRead: boolean }>("/api/updates")
      .then((value) => {
        setRead(value.readIds);
        setCanMarkRead(value.canMarkRead);
      })
      .catch(() => {});
  }, []);
  async function mark(id: string) {
    try {
      await api(`/api/updates/${id}/read`, { method: "POST" });
      setRead((current) => [...new Set([...current, id])]);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not mark update as read.",
      );
    }
  }
  return (
    <>
      <div className="updates-list">
        {updates.map((item) => (
          <article className="react-update-card" key={item.id}>
            <div>
              <span className="section-kicker">
                {item.version} · {item.date}
              </span>
              {canMarkRead && !read.includes(item.id) && (
                <span className="react-unread-dot" aria-label="Unread" />
              )}
            </div>
            <h2>
              <Link href={`/updates/${item.id}`}>{item.title}</Link>
            </h2>
            <p>{item.summary}</p>
            <div className="react-update-actions">
              <Link href={`/updates/${item.id}`}>Read update ↗</Link>
              {canMarkRead && !read.includes(item.id) && (
                <button type="button" onClick={() => mark(item.id)}>
                  Mark as read ✓
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
