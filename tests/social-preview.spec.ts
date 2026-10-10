import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/", label: "root" },
  { path: "/p/bceab6e7-c234-4528-8d8f-2f40f70e114f", label: "shared prompt" },
  { path: "/invite/_cuzEtopXMrI", label: "invite" },
];

for (const { path, label } of PAGES) {
  test(`${label}: tags in raw HTML and the image is valid`, async ({
    request,
    baseURL,
  }) => {
    const html = await (
      await request.get(path, {
        headers: { "User-Agent": "facebookexternalhit/1.1" },
      })
    ).text();
    const tag = (k: string) =>
      new RegExp(
        `<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`,
        "i",
      ).exec(html)?.[1];

    for (const k of [
      "og:title",
      "og:description",
      "og:image",
      "og:url",
      "twitter:card",
      "twitter:image",
    ]) {
      expect(tag(k), `${label}: missing ${k}`).toBeTruthy();
    }
    expect(tag("twitter:card")).toBe("summary_large_image");
    const img = tag("og:image");
    expect(img).toBeTruthy();
    expect(img).toMatch(/^https?:\/\//); // absolute
    expect(img).toBe(tag("twitter:image")); // one image for both

    const t0 = Date.now();
    const targetUrl = (img || "").replace(
      /^https?:\/\/[^/]+/,
      baseURL || "http://localhost:3000",
    );
    const res = await request.get(targetUrl);
    const ms = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    expect(res.headers()["cache-control"]).toMatch(/s-maxage|max-age/);
    const buf = await res.body();
    expect(buf.length).toBeLessThan(600_000); // hard limit; target 300_000
    // PNG IHDR holds width and height at bytes 16–24
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    expect(ms).toBeLessThan(2000);
  });
}

test("unknown ids never leak and never 500", async ({ request }) => {
  const img = await request.get("/api/og/invite/does-not-exist");
  expect(img.status()).toBe(200); // generic card, not 404
  const page = await request.get("/invite/does-not-exist");
  expect(page.status()).toBe(404); // the PAGE is a real 404 (as before)
  const og = await request.get("/api/og/p/does-not-exist");
  expect(og.status()).toBe(200);
});

test("private prompt content never appears in the image route", async ({
  request,
}) => {
  const res = await request.get(
    "/api/og/p/00000000-0000-0000-0000-000000000000",
  );
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).not.toMatch(/s-maxage=86400/); // generic fallback uses the short cache
});
