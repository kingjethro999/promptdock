function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
}

function publishedDate(item) {
  for (const value of [item.publishedAt, item.date]) {
    if (!value) continue;
    const timestamp =
      value instanceof Date ? value.getTime() : Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toUTCString();
  }
  return null;
}

function renderItem(item, origin) {
  const link = new URL("/updates", origin).toString();
  const parts = [
    `<title>${escapeXml(item.title)}</title>`,
    `<link>${escapeXml(link)}</link>`,
    `<guid isPermaLink="false">${escapeXml(`${link}#${item.id}`)}</guid>`,
  ];
  const pubDate = publishedDate(item);
  if (pubDate) parts.push(`<pubDate>${pubDate}</pubDate>`);
  parts.push(
    `<description>${escapeXml(`${item.summary}\n\n${item.body}`)}</description>`,
  );
  return `<item>\n      ${parts.join("\n      ")}\n    </item>`;
}

function renderFeedXml(items, origin, now = new Date()) {
  const channel = [
    `<title>${escapeXml("PromptDock updates")}</title>`,
    `<link>${escapeXml(new URL("/updates", origin).toString())}</link>`,
    `<description>${escapeXml(
      "Release notes and product updates from PromptDock.",
    )}</description>`,
    `<language>en</language>`,
    `<lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `<atom:link href="${escapeXml(new URL("/feed.xml", origin).toString())}" rel="self" type="application/rss+xml" />`,
    ...items.map((item) => renderItem(item, origin)),
  ].join("\n    ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    ${channel}\n  </channel>\n</rss>\n`;
}

module.exports = { escapeXml, renderFeedXml };
