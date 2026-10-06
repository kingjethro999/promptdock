const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const database = require("../src/database");
const auth = require("../src/auth");
const referrals = require("../src/referrals");
const admin = require("../src/admin-server");
const backend = require("../src/backend");
const securityHeaders = require("../src/security");

const root = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;
const devMode = process.env.PROMPTDOCK_DEV === "1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
const publicFiles = new Set([
  "/index.html",
  "/share.html",
  "/privacy.html",
  "/terms.html",
  "/copyright.html",
  "/auth.html",
  "/updates.html",
  "/styles.css",
  "/landing.css",
  "/share.css",
  "/legal.css",
  "/app.js",
  "/share.js",
  "/prompt-format.js",
  "/config.js",
  "/favicon.svg",
  "/social-card.png",
  "/social-card-v2.png",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/auth.css",
  "/auth-page.js",
  "/updates.css",
  "/updates-data.js",
  "/updates-page.js",
  "/assets/brands/openai.png",
  "/assets/brands/anthropic.png",
  "/assets/brands/gemini.png",
  "/assets/brands/github.png",
]);
const adminFiles = new Set(["/admin.html", "/admin.css", "/admin.js"]);
const pageRedirects = {
  "/index.html": "/",
  "/privacy.html": "/privacy",
  "/terms.html": "/terms",
  "/copyright.html": "/copyright",
  "/auth.html": "/auth",
  "/updates.html": "/updates",
};
const adminAssetFiles = {
  "/admin.html": path.join(__dirname, "admin.html"),
  "/admin.css": path.join(__dirname, "styles", "admin.css"),
  "/admin.js": path.join(__dirname, "admin.js"),
};

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function stripSeoBlock(html) {
  return html.replace(/<!--SEO_START-->[\s\S]*?<!--SEO_END-->/, "");
}

function serveNotFound(response) {
  fs.readFile(path.join(root, "404.html"), (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  });
}

function publicOrigin(request) {
  const fallbackHost = process.env.VERCEL
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : request.headers.host;
  return process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : `${process.env.VERCEL ? "https" : "http"}://${fallbackHost}`;
}

function renderInviteHtml(template, inviter, code, canonical, image) {
  const name = inviter.username || "A PromptDock member";
  const title = `${name} invited you to PromptDock`;
  const description =
    "Turn rough ideas into prompts worth keeping. Create a free workspace, save what works, and share it with others.";
  const meta = `<meta name="robots" content="noindex,follow"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PromptDock — Good ideas deserve a clearer prompt"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><link rel="canonical" href="${escapeHtml(canonical)}">`;
  return stripSeoBlock(template)
    .replace(
      "<title>PromptDock — Your AI prompt workspace</title>",
      `<title>${escapeHtml(title)}</title>`,
    )
    .replace(
      'content="Build better prompts, save what works, and use them with your favorite AI platform."',
      `content="${escapeHtml(description)}"`,
    )
    .replace("<!--INVITE_META-->", meta)
    .replace(
      /<body\b([^>]*)>/,
      `<body$1 data-invite-code="${escapeHtml(code)}">`,
    )
    .replace(
      "<!--INVITE_BANNER-->",
      `<div class="invite-banner"><span class="invite-banner-mark" aria-hidden="true">✳</span><div><strong>${escapeHtml(name)} invited you in</strong><p>Bring a rough idea. Leave with a prompt you can actually use.</p></div><button type="button" data-auth-mode="register">Join PromptDock <span aria-hidden="true">↗</span></button></div>`,
    );
}

async function serveInvitePage(request, response, code) {
  try {
    const inviter = await referrals.inviterFor(code);
    if (!inviter) {
      response
        .writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end("Invitation unavailable.");
      return;
    }
    const origin = publicOrigin(request);
    const canonical = new URL(`/invite/${code}`, origin).toString();
    const image = new URL("/social-card.png", origin).toString();
    const template = await fs.promises.readFile(
      path.join(root, "index.html"),
      "utf8",
    );
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(renderInviteHtml(template, inviter, code, canonical, image));
  } catch {
    json(response, 503, { error: "Invitation is unavailable right now." });
  }
}

function renderSharedHtml(template, prompt, canonical, image) {
  const username =
    typeof prompt.ownerUsername === "string" ? prompt.ownerUsername.trim() : "";
  const title = username
    ? `${username} wants to share a prompt with you`
    : `${prompt.name} — PromptDock`;
  const description = String(prompt.data?.task || "A shared PromptDock prompt")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const meta = `<meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><link rel="canonical" href="${escapeHtml(canonical)}">`;
  return stripSeoBlock(template)
    .replace(
      "<title>Shared prompt — PromptDock</title>",
      `<title>${escapeHtml(title)}</title>`,
    )
    .replace(
      'content="Explore a shared PromptDock prompt. Copy it or save your own version."',
      `content="${escapeHtml(description)}"`,
    )
    .replace("<!--PROMPT_META-->", meta)
    .replace(
      "<!--SHARED_INTRO-->",
      username ? `${escapeHtml(username)} shared a prompt with you. ` : "",
    );
}

async function serveSharedPage(request, response, publicId) {
  try {
    const prompt = await database.getPublicPrompt(publicId);
    if (!prompt) {
      response
        .writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end("Shared prompt unavailable.");
      return;
    }
    const origin = publicOrigin(request);
    const canonical = new URL(`/p/${publicId}`, origin).toString();
    const image = new URL("/social-card.png", origin).toString();
    const template = await fs.promises.readFile(
      path.join(root, "share.html"),
      "utf8",
    );
    const html = renderSharedHtml(template, prompt, canonical, image);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(html);
  } catch {
    json(response, 503, { error: "Shared prompt service is unavailable." });
  }
}

async function handleRequest(request, response) {
  for (const [name, value] of Object.entries(securityHeaders))
    response.setHeader(name, value);
  let pathname;
  let url;
  try {
    url = new URL(request.url, "http://localhost");
    const route = url.searchParams.get("route");
    pathname = route ? `/api/${route}` : decodeURIComponent(url.pathname);
    const adminFile = url.searchParams.get("admin");
    if (adminFiles.has(adminFile)) pathname = adminFile;
    if (url.searchParams.get("feed") === "1") pathname = "/feed.xml";
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (devMode && pathname === "/__dev/revision") {
    fs.readFile(path.join(root, ".dev-revision"), "utf8", (error, value) => {
      response.writeHead(error ? 503 : 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(error ? "Waiting for build" : value);
    });
    return;
  }
  if (devMode && pathname === "/__dev/reload.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(path.join(__dirname, "dev-reload.js")).pipe(response);
    return;
  }
  const sharedPageId =
    new URL(request.url, "http://localhost").searchParams.get("share") ||
    pathname.match(/^\/p\/([0-9a-f-]{36})$/i)?.[1];
  if (sharedPageId && request.method === "GET") {
    await serveSharedPage(request, response, sharedPageId);
    return;
  }
  const inviteCode =
    url.searchParams.get("invite") ||
    pathname.match(/^\/invite\/([A-Za-z0-9_-]{12})$/)?.[1];
  if (inviteCode && request.method === "GET") {
    await serveInvitePage(request, response, inviteCode);
    return;
  }
  if (pathname.startsWith("/api/") || pathname === "/feed.xml") {
    await backend(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  if (pageRedirects[pathname]) {
    response.writeHead(308, { Location: pageRedirects[pathname] });
    response.end();
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/auth") pathname = "/auth.html";
  if (pathname === "/admin") pathname = "/admin.html";
  if (pathname === "/updates" || pathname.startsWith("/updates/"))
    pathname = "/updates.html";
  if (["/privacy", "/terms", "/copyright"].includes(pathname))
    pathname += ".html";
  if (adminFiles.has(pathname)) {
    const viewer = await auth.currentUser(request).catch(() => null);
    if (!admin.isAdmin(viewer)) {
      response.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end("Admin access required.");
      return;
    }
  } else if (!publicFiles.has(pathname)) {
    if (pathname.startsWith("/api/"))
      json(response, 404, { error: "Not found." });
    else serveNotFound(response);
    return;
  }
  const file = adminFiles.has(pathname)
    ? adminAssetFiles[pathname]
    : path.join(root, pathname);
  fs.readFile(file, (error, data) => {
    if (error) {
      serveNotFound(response);
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "Cache-Control": adminFiles.has(pathname) ? "no-store" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (devMode && path.extname(file) === ".html") {
      response.end(
        data
          .toString("utf8")
          .replace(
            "</body>",
            '<script defer src="/__dev/reload.js"></script></body>',
          ),
      );
    } else response.end(data);
  });
}

if (require.main === module)
  http
    .createServer(handleRequest)
    .listen(port, "0.0.0.0", () =>
      console.log(`PromptDock is running on port ${port}`),
    );
module.exports = handleRequest;
module.exports.renderSharedHtml = renderSharedHtml;
module.exports.renderInviteHtml = renderInviteHtml;
