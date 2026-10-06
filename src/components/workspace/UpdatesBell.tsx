"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";

type Update = {
  id: string;
  title: string;
  summary: string;
  version: string;
  date: string;
};
type Payload = { updates: Update[]; readIds: string[]; canMarkRead: boolean };

export default function UpdatesBell() {
  const [items, setItems] = useState<Update[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const known = useRef(new Set<string>());
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const payload = await api<Payload>("/api/updates");
        if (!active) return;
        const incoming = payload.updates.filter(
          (item) => !known.current.has(item.id),
        );
        if (loaded.current && incoming.length) {
          setToast(`${incoming[0].version}: ${incoming[0].title}`);
          setTimeout(() => setToast(""), 2000);
        }
        known.current = new Set(payload.updates.map((item) => item.id));
        loaded.current = true;
        setItems(payload.updates);
        setRead(payload.readIds || []);
      } catch {
        /* Keep the last successfully loaded updates. */
      }
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function mark(id: string) {
    try {
      await api(`/api/updates/${encodeURIComponent(id)}/read`, {
        method: "POST",
      });
      setRead((current) => [...new Set([...current, id])]);
    } catch {
      setToast("Could not mark this update as read.");
    }
  }

  const latest = items.slice(0, 3);
  const unread = latest.filter((item) => !read.includes(item.id)).length;
  return (
    <div className="updates-menu">
      <button
        className="updates-button"
        type="button"
        aria-label="Product updates"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && <span className="updates-badge">{unread}</span>}
      </button>
      {open && (
        <div
          className="updates-popover"
          role="status"
          aria-label="Latest product updates"
        >
          <div className="updates-popover-head">
            <strong>Latest updates</strong>
            <button
              type="button"
              onClick={() =>
                latest
                  .filter((item) => !read.includes(item.id))
                  .forEach((item) => mark(item.id))
              }
            >
              Mark all read
            </button>
          </div>
          <div>
            {latest.map((item) => (
              <article
                className={`updates-preview-item${read.includes(item.id) ? " is-read" : ""}`}
                key={item.id}
              >
                <Link
                  href={`/updates/${item.id}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="updates-preview-meta">
                    {item.version} · {item.date}
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Mark ${item.title} as read`}
                  onClick={() => mark(item.id)}
                >
                  ✓
                </button>
              </article>
            ))}
          </div>
          <Link className="updates-see-all" href="/updates">
            See all updates ↗
          </Link>
        </div>
      )}
      {toast && (
        <div className="react-live-toast" role="status">
          New update · {toast}
        </div>
      )}
    </div>
  );
}
