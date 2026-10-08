"use client";

import NextTopLoader from "nextjs-toploader";

export default function TopLoader() {
  return (
    <NextTopLoader
      color="#d6f57e"
      initialPosition={0.08}
      crawlSpeed={200}
      height={3}
      crawl={true}
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow="0 0 12px rgba(214, 245, 126, 0.7), 0 0 5px rgba(214, 245, 126, 0.5)"
      zIndex={1600}
      showAtBottom={false}
    />
  );
}
