import { OG_DEFAULT_IMAGE, SITE_URL } from "@/lib/site";

/**
 * Finishes rendering an Open Graph image before answering, so a failure in
 * the renderer (fonts, layout, data) sends crawlers to the static default
 * card instead of a broken or empty image. Buffering also gives the response
 * a Content-Length, which some link-preview fetchers require.
 */
export async function ogResponse(
  build: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    const image = await build();
    const body = await image.arrayBuffer();
    if (!image.ok || body.byteLength === 0) throw new Error("empty image");
    const headers = new Headers(image.headers);
    headers.set("Content-Length", String(body.byteLength));
    return new Response(body, { status: 200, headers });
  } catch {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL(OG_DEFAULT_IMAGE.url, SITE_URL).toString(),
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
