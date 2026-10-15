import { useCallback, useRef, useState } from "react";

export type CommitKey = "name" | "avatar" | "banner" | "bio";

export function useCommitQueue() {
  const pending = useRef(new Map<CommitKey, Promise<void>>());
  const jobs = useRef(new Map<CommitKey, () => Promise<void>>());
  const [failed, setFailed] = useState<Partial<Record<CommitKey, string>>>({});

  const run = useCallback((key: CommitKey, job: () => Promise<void>) => {
    jobs.current.set(key, job);
    const prev = pending.current.get(key) ?? Promise.resolve();
    const p: Promise<void> = prev
      .catch(() => {})
      .then(job)
      .then(() =>
        setFailed((f) => {
          const next = { ...f };
          delete next[key];
          return next;
        }),
      )
      .catch((e) =>
        setFailed((f) => ({
          ...f,
          [key]: friendly(e),
        })),
      )
      .finally(() => {
        if (pending.current.get(key) === p) pending.current.delete(key);
      });
    pending.current.set(key, p);
  }, []);

  return {
    run,
    failed,
    retry: useCallback(
      (key: CommitKey) => {
        const j = jobs.current.get(key);
        if (j) run(key, j);
      },
      [run],
    ),
    settled: useCallback(
      () => Promise.allSettled([...pending.current.values()]),
      [],
    ),
    busy: useCallback(() => pending.current.size > 0, []),
  };
}

function friendly(e: unknown) {
  if (e instanceof Error && e.message.toLowerCase().includes("image")) {
    return "We couldn't open that image. Try a JPG, PNG or WebP.";
  }
  return "That didn't save. Try again.";
}
