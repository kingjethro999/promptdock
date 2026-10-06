"use client";

import { useEffect, useRef, useState } from "react";
import { validateAttachments } from "@/lib/client/images";

export type Attachment = { file: File; preview: string };

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const previews = useRef(new Set<string>());
  useEffect(
    () => () => previews.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  function add(files: File[]) {
    const merged = [...attachments.map((item) => item.file), ...files];
    validateAttachments(merged);
    const added = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { file, preview };
    });
    setAttachments((current) => [...current, ...added]);
  }

  function remove(index: number) {
    setAttachments((current) =>
      current.filter((item, position) => {
        if (position !== index) return true;
        URL.revokeObjectURL(item.preview);
        previews.current.delete(item.preview);
        return false;
      }),
    );
  }

  function clear() {
    setAttachments((current) => {
      current.forEach((item) => {
        URL.revokeObjectURL(item.preview);
        previews.current.delete(item.preview);
      });
      return [];
    });
  }

  return {
    attachments,
    files: attachments.map((item) => item.file),
    add,
    remove,
    clear,
  };
}
