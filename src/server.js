const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ai = require("./ai");
const {
  MAX_AUDIO_BYTES,
  normalizeAudioType,
  transcribeAudio,
} = require("./speech");
const { version } = require("../package.json");
const database = require("./database");
const auth = require("./auth");
const settings = require("./settings");
const rateLimit = require("./rate-limit");
const securityHeaders = require("./security");

const root = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const publicFiles = new Set([
  "/index.html",
  "/share.html",
  "/styles.css",
  "/landing.css",
  "/share.css",
  "/app.js",
  "/share.js",
  "/prompt-format.js",
  "/config.js",
  "/favicon.svg",
  "/social-card.png",
]);

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, maxBytes = 72000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON.");
  }
}

async function readAudio(request) {
  if (Number(request.headers["content-length"]) > MAX_AUDIO_BYTES)
    throw new Error("Recording is too large. Keep it under 4 MB.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_AUDIO_BYTES)
      throw new Error("Recording is too large. Keep it under 4 MB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  return (
    origin === `https://${host}` ||
    (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || "") &&
      origin === `http://${host}`)
  );
}

function rateSubject(user) {
  return user ? `user:${user.id}` : null;
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

function renderSharedHtml(template, prompt, canonical, image) {
  const title = `${prompt.name} — PromptDock`;
  const description = String(prompt.data?.task || "A shared PromptDock prompt")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const meta = `<meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><link rel="canonical" href="${escapeHtml(canonical)}">`;
  return template
    .replace(
      "<title>Shared prompt — PromptDock</title>",
      `<title>${escapeHtml(title)}</title>`,
    )
    .replace(
      'content="Explore a shared PromptDock prompt. Copy it or save your own version."',
      `content="${escapeHtml(description)}"`,
    )
    .replace("<!--PROMPT_META-->", meta);
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
    const fallbackHost = process.env.VERCEL
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
      : request.headers.host;
    const origin = process.env.APP_URL
      ? new URL(process.env.APP_URL).origin
      : `${process.env.VERCEL ? "https" : "http"}://${fallbackHost}`;
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
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const sharedPageId =
    new URL(request.url, "http://localhost").searchParams.get("share") ||
    pathname.match(/^\/p\/([0-9a-f-]{36})$/i)?.[1];
  if (sharedPageId && request.method === "GET") {
    await serveSharedPage(request, response, sharedPageId);
    return;
  }
  if (pathname === "/api/status" && request.method === "GET") {
    try {
      const user = database.configured ? await auth.currentUser(request) : null;
      const env = user ? await settings.effectiveEnv(user.id) : process.env;
      json(response, 200, {
        aiAvailable: ai.configuredProviders(env).length > 0,
        voiceAvailable: Boolean(env.GROQ_API_KEY),
        databaseAvailable: database.configured,
        byokAvailable: Boolean(settings.encryptionKey()),
        version: `v${version}`,
      });
    } catch {
      json(response, 503, { error: "Service status is unavailable." });
    }
    return;
  }
  if (pathname === "/api/health" && request.method === "GET") {
    try {
      if (!database.pool) {
        json(response, 503, {
          ok: false,
          error: "Database is not configured.",
        });
        return;
      }
      await database.ensureSchema();
      json(response, 200, { ok: true });
    } catch {
      json(response, 503, { ok: false });
    }
    return;
  }
  if (pathname === "/api/auth/me" && request.method === "GET") {
    try {
      json(response, 200, { user: await auth.currentUser(request) });
    } catch {
      json(response, 503, { error: "Account service is unavailable." });
    }
    return;
  }
  if (
    [
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/import-legacy",
      "/api/auth/resend",
      "/api/auth/forgot",
      "/api/auth/verify",
      "/api/auth/reset",
      "/api/auth/change-password",
      "/api/auth/logout-all",
    ].includes(pathname) &&
    request.method === "POST"
  ) {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    if (!database.configured) {
      json(response, 503, { error: "Database is not configured." });
      return;
    }
    if (rateLimit.policies[pathname]) {
      try {
        const limit = await rateLimit.consume(request, pathname);
        if (!limit.allowed) {
          json(
            response,
            429,
            { error: "Too many attempts. Try again shortly." },
            { "Retry-After": String(limit.retryAfter) },
          );
          return;
        }
      } catch {
        json(response, 503, { error: "Account service is unavailable." });
        return;
      }
    }
    try {
      if (pathname === "/api/auth/logout") {
        await auth.logout(request);
        json(
          response,
          200,
          { ok: true },
          { "Set-Cookie": auth.clearCookie(request) },
        );
      } else if (pathname === "/api/auth/logout-all") {
        const user = await auth.currentUser(request);
        if (!user) {
          json(response, 401, { error: "Sign in first." });
          return;
        }
        await auth.logoutAll(user.id);
        json(
          response,
          200,
          { ok: true },
          { "Set-Cookie": auth.clearCookie(request) },
        );
      } else if (pathname === "/api/auth/import-legacy") {
        const user = await auth.currentUser(request);
        if (!user) {
          json(response, 401, { error: "Sign in to sync your library." });
          return;
        }
        await database.importLegacy(
          user.id,
          request.headers["x-workspace-token"],
        );
        json(response, 200, { ok: true });
      } else {
        if (!request.headers["content-type"]?.startsWith("application/json")) {
          json(response, 415, { error: "Use JSON." });
          return;
        }
        const body = await readBody(request);
        if (pathname === "/api/auth/register")
          json(response, 200, await auth.register(body));
        else if (pathname === "/api/auth/login") {
          const result = await auth.login(body, request);
          json(
            response,
            200,
            { user: result.user },
            { "Set-Cookie": result.cookie },
          );
        } else if (pathname === "/api/auth/resend")
          json(response, 200, await auth.resendVerification(body));
        else if (pathname === "/api/auth/forgot")
          json(response, 200, await auth.forgotPassword(body));
        else if (pathname === "/api/auth/verify")
          json(response, 200, await auth.consumeToken(body?.token, "verify"));
        else if (pathname === "/api/auth/reset")
          json(
            response,
            200,
            await auth.consumeToken(body?.token, "reset", body?.password),
          );
        else if (pathname === "/api/auth/change-password") {
          const user = await auth.currentUser(request);
          if (!user) {
            json(response, 401, { error: "Sign in first." });
            return;
          }
          const result = await auth.changePassword(user, body, request);
          json(response, 200, { ok: true }, { "Set-Cookie": result.cookie });
        }
      }
    } catch (error) {
      json(response, error.status || 503, {
        error: error.status ? error.message : "Account service is unavailable.",
        code:
          error.code &&
          typeof error.code === "string" &&
          !/^\d/.test(error.code)
            ? error.code
            : undefined,
      });
    }
    return;
  }
  if (
    pathname === "/api/settings" &&
    ["GET", "PUT", "DELETE"].includes(request.method)
  ) {
    if (request.method !== "GET" && !validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    try {
      const user = await auth.currentUser(request);
      if (!user) {
        json(response, 401, { error: "Sign in first." });
        return;
      }
      if (request.method === "GET")
        json(response, 200, await settings.getSettings(user.id));
      else if (request.method === "DELETE")
        json(response, 200, await settings.deleteSettings(user.id));
      else {
        if (!request.headers["content-type"]?.startsWith("application/json")) {
          json(response, 415, { error: "Use JSON." });
          return;
        }
        json(
          response,
          200,
          await settings.saveSettings(user.id, await readBody(request)),
        );
      }
    } catch (error) {
      const validation = /^(Choose Groq|Enter a valid|Enter an API key)/.test(
        error.message,
      );
      json(response, validation ? 400 : 503, {
        error: validation ? error.message : "Settings are unavailable.",
      });
    }
    return;
  }
  const sharedPrompt = pathname.match(
    /^\/api\/public\/prompts\/([^/]+)(\/fork)?$/,
  );
  if (sharedPrompt && (request.method === "GET" || request.method === "POST")) {
    if (request.method === "POST" && !validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    try {
      if (request.method === "GET" && !sharedPrompt[2]) {
        const prompt = await database.getPublicPrompt(sharedPrompt[1]);
        json(
          response,
          prompt ? 200 : 404,
          prompt ? { prompt } : { error: "This shared prompt is unavailable." },
        );
      } else if (request.method === "POST" && sharedPrompt[2]) {
        const user = await auth.currentUser(request);
        if (!user) {
          json(response, 401, { error: "Sign in to save this prompt." });
          return;
        }
        const prompt = await database.forkPublicPrompt(
          database.accountKey(user.id),
          sharedPrompt[1],
        );
        json(
          response,
          prompt ? 200 : 404,
          prompt ? { prompt } : { error: "This shared prompt is unavailable." },
        );
      } else json(response, 405, { error: "Method not allowed." });
    } catch {
      json(response, 503, { error: "Shared prompt service is unavailable." });
    }
    return;
  }
  const publishPrompt = pathname.match(/^\/api\/prompts\/([^/]+)\/public$/);
  if (publishPrompt && request.method === "PATCH") {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    try {
      const user = await auth.currentUser(request);
      if (!user) {
        json(response, 401, { error: "Sign in to share a prompt." });
        return;
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        json(response, 415, { error: "Use JSON." });
        return;
      }
      const body = await readBody(request);
      if (typeof body?.published !== "boolean") {
        json(response, 400, {
          error: "Choose whether to make this prompt public.",
        });
        return;
      }
      const prompt = await database.setPromptPublic(
        database.accountKey(user.id),
        publishPrompt[1],
        body.published,
      );
      json(
        response,
        prompt ? 200 : 404,
        prompt ? { prompt } : { error: "Prompt not found." },
      );
    } catch (error) {
      json(response, error.message === "Invalid sharing request." ? 400 : 503, {
        error:
          error.message === "Invalid sharing request."
            ? error.message
            : "Could not update sharing.",
      });
    }
    return;
  }
  if (pathname === "/api/prompts" || pathname.startsWith("/api/prompts/")) {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    if (!database.configured) {
      json(response, 503, { error: "Database is not configured." });
      return;
    }
    try {
      const user = await auth.currentUser(request);
      if (!user) {
        json(response, 401, { error: "Sign in to sync your library." });
        return;
      }
      const key = database.accountKey(user.id);
      if (pathname === "/api/prompts" && request.method === "GET")
        json(
          response,
          200,
          await database.listPrompts(key, {
            q: url.searchParams.get("q"),
            offset: url.searchParams.get("offset"),
            tag: url.searchParams.get("tag"),
            sort: url.searchParams.get("sort") || undefined,
          }),
        );
      else if (pathname === "/api/prompts" && request.method === "PUT")
        json(response, 200, {
          prompt: await database.putPrompt(key, await readBody(request)),
        });
      else if (pathname === "/api/prompts/tags" && request.method === "GET")
        json(response, 200, { tags: await database.listTags(key) });
      else if (pathname === "/api/prompts/import" && request.method === "POST")
        json(response, 201, {
          imported: await database.importPrompts(
            key,
            await readBody(request, 1500000),
          ),
        });
      else if (
        /^\/api\/prompts\/[0-9a-f-]{36}\/revisions$/i.test(pathname) &&
        request.method === "GET"
      ) {
        const id = pathname.split("/")[3];
        const revisions = await database.listRevisions(key, id);
        json(
          response,
          revisions ? 200 : 404,
          revisions ? { revisions } : { error: "Prompt not found." },
        );
      } else if (
        /^\/api\/prompts\/[0-9a-f-]{36}\/revisions\/\d+\/restore$/i.test(
          pathname,
        ) &&
        request.method === "POST"
      ) {
        const parts = pathname.split("/");
        const prompt = await database.restoreRevision(key, parts[3], parts[5]);
        json(
          response,
          prompt ? 200 : 404,
          prompt ? { prompt } : { error: "Revision not found." },
        );
      } else if (
        /^\/api\/prompts\/[0-9a-f-]{36}\/duplicate$/i.test(pathname) &&
        request.method === "POST"
      ) {
        const prompt = await database.duplicatePrompt(
          key,
          pathname.split("/")[3],
        );
        json(
          response,
          prompt ? 201 : 404,
          prompt ? { prompt } : { error: "Prompt not found." },
        );
      } else if (
        pathname.startsWith("/api/prompts/") &&
        request.method === "DELETE"
      ) {
        await database.deletePrompt(
          key,
          pathname.slice("/api/prompts/".length),
        );
        json(response, 200, { ok: true });
      } else json(response, 405, { error: "Method not allowed." });
    } catch (error) {
      const status =
        /required|Invalid|must be|too long|too large|task|Import |Use up to/i.test(
          error.message,
        )
          ? 400
          : 503;
      json(response, status, {
        error: status === 400 ? error.message : "Database is unavailable.",
      });
    }
    return;
  }
  if (pathname === "/api/transcribe" && request.method === "POST") {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    try {
      const user = database.configured ? await auth.currentUser(request) : null;
      if (database.configured && !user) {
        json(response, 401, { error: "Sign in first." });
        return;
      }
      const audio = await readAudio(request);
      normalizeAudioType(request.headers["content-type"]);
      if (audio.length < 100) {
        json(response, 400, {
          error: "Recording is too short. Try speaking again.",
        });
        return;
      }
      const limit = await rateLimit.consume(request, pathname, {
        subject: rateSubject(user),
      });
      if (!limit.allowed) {
        json(
          response,
          429,
          { error: "Voice limit reached. Try again shortly." },
          { "Retry-After": String(limit.retryAfter) },
        );
        return;
      }
      const env = user ? await settings.effectiveEnv(user.id) : process.env;
      json(response, 200, {
        text: await transcribeAudio(
          audio,
          request.headers["content-type"],
          env,
        ),
      });
    } catch (error) {
      const message = error.message;
      const status = message.startsWith("Recording is too large")
        ? 413
        : [
              "This audio format is not supported.",
              "Recording is too short. Try speaking again.",
            ].includes(message)
          ? 400
          : 503;
      json(response, status, { error: message });
    }
    return;
  }
  if (
    ["/api/enhance", "/api/idea-to-prompt", "/api/run"].includes(pathname) &&
    request.method === "POST"
  ) {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      json(response, 415, { error: "Use JSON." });
      return;
    }
    try {
      const user = database.configured ? await auth.currentUser(request) : null;
      if (database.configured && !user) {
        json(response, 401, { error: "Sign in first." });
        return;
      }
      const body = await readBody(request);
      if (pathname === "/api/idea-to-prompt") ai.normalizeIdea(body);
      else if (pathname === "/api/enhance") ai.normalizeDraft(body);
      else ai.normalizeRunInput(body);
      const limit = await rateLimit.consume(request, pathname, {
        subject: rateSubject(user),
      });
      if (!limit.allowed) {
        json(
          response,
          429,
          { error: "AI request limit reached. Try again shortly." },
          { "Retry-After": String(limit.retryAfter) },
        );
        return;
      }
      const env = user ? await settings.effectiveEnv(user.id) : process.env;
      if (pathname === "/api/run")
        json(response, 200, await ai.runPrompt(body, env));
      else
        json(
          response,
          200,
          await (pathname === "/api/idea-to-prompt"
            ? ai.ideaToPrompt(body, env)
            : ai.enhanceWithAI(body, env)),
        );
    } catch (error) {
      const message = error.message;
      const status = [
        "Draft is too long.",
        "Idea is too long.",
        "Prompt is too long to run.",
      ].includes(message)
        ? 413
        : [
              "Invalid JSON.",
              "Add a task before enhancing.",
              "Describe your idea in a few words.",
              "Add a task before running the prompt.",
            ].includes(message)
          ? 400
          : 503;
      json(response, status, { error: message });
    }
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  if (!publicFiles.has(pathname)) {
    response.writeHead(404).end("Not found");
    return;
  }
  const file = path.join(root, pathname);
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
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
