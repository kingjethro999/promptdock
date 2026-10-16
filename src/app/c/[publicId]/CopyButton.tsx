"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function CopyButton({
  url,
  label = "Share",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Button variant="secondary" onClick={handleCopy}>
      <Icon name={copied ? "check" : "link"} size={14} />
      <span>{copied ? "Copied!" : label}</span>
    </Button>
  );
}
