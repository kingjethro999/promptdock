"use client";

import { useEffect, useState } from "react";

export default function BootScreen() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.documentElement.classList.remove("booting");
      document.body.classList.remove("booting");
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready ? null : (
    <div className="boot-screen" role="status">
      <span className="boot-mark">✳</span>
      <span>Opening PromptDock…</span>
    </div>
  );
}
