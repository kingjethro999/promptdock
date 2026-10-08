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
const referrals = require("./referrals");
const updates = require("./updates");
const feed = require("./feed");
const admin = require("./admin-server");
const mailer = require("./mailer");
const securityHeaders = require("./security");

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, maxBytes = 1000000) {
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

function publicOrigin(request) {
  const fallbackHost = process.env.VERCEL
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : request.headers.host;
  return process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : `${process.env.VERCEL ? "https" : "http"}://${fallbackHost}`;
}

async function mergedUpdates() {
  const databaseUpdates = database.configured
    ? await database.listPublishedUpdates()
    : [];
  return [
    ...databaseUpdates,
    ...updates.filter(
      (item) => !databaseUpdates.some((saved) => saved.id === item.id),
    ),
  ];
}

async function handleBackendRequest(request, response) {
  for (const [name, value] of Object.entries(securityHeaders))
    response.setHeader(name, value);
  let pathname;
  let url;
  try {
    url = new URL(request.url, "http://localhost");
    const route = url.searchParams.get("route");
    pathname = route ? `/api/${route}` : decodeURIComponent(url.pathname);
    if (url.searchParams.get("feed") === "1") pathname = "/feed.xml";
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (!pathname.startsWith("/api/") && pathname !== "/feed.xml") {
    json(response, 404, { error: "Not found." });
    return;
  }
  if (pathname === "/api/referrals") {
    if (request.method !== "GET") {
      json(response, 405, { error: "Method not allowed." });
      return;
    }
    try {
      const user = await auth.currentUser(request);
      if (!user) {
        json(response, 401, { error: "Sign in to invite friends." });
        return;
      }
      const summary = await referrals.summary(user);
      json(response, 200, {
        ...summary,
        url: new URL(
          `/invite/${summary.code}`,
          publicOrigin(request),
        ).toString(),
      });
    } catch {
      json(response, 503, { error: "Invitations are unavailable right now." });
    }
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
  if (pathname === "/api/feedback") {
    if (request.method !== "POST") {
      json(response, 405, { error: "Method not allowed." });
      return;
    }
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      json(response, 415, { error: "Send feedback as JSON." });
      return;
    }
    if (!database.configured) {
      json(response, 503, { error: "Feedback is unavailable right now." });
      return;
    }
    try {
      const body = await readBody(request, 32000);
      database.validateFeedback(body);
      const user = await auth.currentUser(request);
      const limit = admin.isAdmin(user)
        ? { allowed: true }
        : await rateLimit.consume(request, pathname, {
            ...(user ? { subject: rateSubject(user) } : {}),
          });
      if (!limit.allowed) {
        json(
          response,
          429,
          { error: "Too many reports. Please try again later." },
          { "Retry-After": String(limit.retryAfter) },
        );
        return;
      }
      const id = await database.createFeedback(body, user?.id || null);
      mailer
        .sendFeedbackEmail(body)
        .catch((error) =>
          console.error("Feedback email delivery failed:", error.message),
        );
      json(response, 201, { ok: true, id, notified: true });
    } catch (error) {
      const invalid = [
        "Invalid JSON.",
        "Request is too large.",
        "Enter a report before sending.",
        "Choose a feedback type.",
        "Write a report between 1 and 10,000 characters.",
        "Enter a valid email address or leave it blank.",
      ].includes(error.message);
      json(response, invalid ? 400 : 503, {
        error: invalid ? error.message : "Feedback is unavailable right now.",
      });
    }
    return;
  }
  if (pathname === "/api/auth/me" && request.method === "GET") {
    try {
      const user = await auth.currentUser(request);
      json(response, 200, { user, admin: admin.isAdmin(user) });
    } catch {
      json(response, 503, { error: "Account service is unavailable." });
    }
    return;
  }
  if (pathname === "/api/updates" && request.method === "GET") {
    try {
      const user = await auth.currentUser(request).catch(() => null);
      const merged = await mergedUpdates();
      json(response, 200, {
        updates: merged,
        canMarkRead: Boolean(user && database.configured),
        readIds:
          user && database.configured
            ? await database.listReadUpdates(user.id)
            : [],
      });
    } catch {
      json(response, 200, { updates, readIds: [], canMarkRead: false });
    }
    return;
  }
  if (pathname === "/feed.xml" && request.method === "GET") {
    let merged;
    try {
      merged = await mergedUpdates();
    } catch {
      merged = updates;
    }
    response.writeHead(200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(feed.renderFeedXml(merged, publicOrigin(request)));
    return;
  }
  if (pathname === "/api/admin/me" && request.method === "GET") {
    const user = await auth.currentUser(request).catch(() => null);
    json(response, 200, { admin: admin.isAdmin(user) });
    return;
  }
  if (
    pathname.startsWith("/api/admin/") &&
    ["GET", "POST", "DELETE"].includes(request.method)
  ) {
    if (!validOrigin(request))
      return json(response, 403, { error: "Invalid origin." });
    const user = await auth.currentUser(request).catch(() => null);
    if (!admin.isAdmin(user))
      return json(response, 403, { error: "Admin access required." });
    if (!database.configured)
      return json(response, 503, { error: "Admin data is unavailable." });
    try {
      if (pathname === "/api/admin/updates" && request.method === "POST") {
        if (!request.headers["content-type"]?.startsWith("application/json"))
          return json(response, 415, { error: "Send updates as JSON." });
        const created = await database.createUpdate(await readBody(request));
        json(response, 201, { update: created });
      } else if (
        pathname.startsWith("/api/admin/updates/") &&
        request.method === "DELETE"
      ) {
        const id = decodeURIComponent(
          pathname.slice("/api/admin/updates/".length),
        );
        const removed = await database.deleteUpdate(id);
        if (!removed)
          return json(response, 404, { error: "Update not found." });
        json(response, 200, { ok: true, id });
      } else if (
        pathname === "/api/admin/feedback" &&
        request.method === "GET"
      ) {
        json(response, 200, { feedback: await database.listFeedback() });
      } else if (
        pathname === "/api/admin/analytics" &&
        request.method === "GET"
      ) {
        json(response, 200, { analytics: await database.analytics() });
      } else json(response, 404, { error: "Admin route not found." });
    } catch (error) {
      const invalid = /invalid|Complete|Update ID|Invalid JSON|too large/i.test(
        error.message,
      );
      json(response, error.code === "23505" ? 409 : invalid ? 400 : 503, {
        error:
          error.code === "23505"
            ? "An update with this ID already exists."
            : invalid
              ? error.message
              : "Admin data is unavailable.",
      });
    }
    return;
  }
  const updateRead = pathname.match(/^\/api\/updates\/([^/]+)\/read$/);
  if (
    (updateRead || pathname === "/api/updates/read-all") &&
    request.method === "POST"
  ) {
    if (!validOrigin(request))
      return json(response, 403, { error: "Invalid origin." });
    const user = await auth.currentUser(request).catch(() => null);
    if (!user)
      return json(response, 401, { error: "Sign in to save update state." });
    if (!database.configured)
      return json(response, 503, { error: "Update state is unavailable." });
    try {
      const databaseUpdates = await database.listPublishedUpdates();
      const availableUpdates = [
        ...databaseUpdates,
        ...updates.filter(
          (item) => !databaseUpdates.some((saved) => saved.id === item.id),
        ),
      ];
      if (updateRead) {
        if (!availableUpdates.some((item) => item.id === updateRead[1]))
          return json(response, 404, { error: "Update not found." });
        await database.markUpdateRead(user.id, updateRead[1]);
      } else
        await database.markAllUpdatesRead(
          user.id,
          availableUpdates.map((item) => item.id),
        );
      json(response, 200, { ok: true });
    } catch {
      json(response, 503, { error: "Update state is unavailable." });
    }
    return;
  }
  if (pathname === "/api/auth/username-check" && request.method === "GET") {
    if (!database.configured) {
      json(response, 503, { error: "Account service is unavailable." });
      return;
    }
    try {
      const user = await auth.currentUser(request).catch(() => null);
      const limit = admin.isAdmin(user)
        ? { allowed: true }
        : await rateLimit.consume(request, pathname);
      if (!limit.allowed) {
        json(
          response,
          429,
          { error: "Too many username checks. Try again shortly." },
          { "Retry-After": String(limit.retryAfter) },
        );
        return;
      }
      json(
        response,
        200,
        await auth.checkUsername(url.searchParams.get("username"), user?.id),
      );
    } catch (error) {
      json(response, error.status || 503, {
        error: error.status ? error.message : "Username check is unavailable.",
      });
    }
    return;
  }
  if (pathname === "/api/auth/username" && request.method === "PUT") {
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
        json(response, 401, { error: "Sign in first." });
        return;
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        json(response, 415, { error: "Use JSON." });
        return;
      }
      const body = await readBody(request);
      json(response, 200, await auth.updateUsername(user, body));
    } catch (error) {
      json(response, error.status || 503, {
        error: error.status ? error.message : "Account service is unavailable.",
      });
    }
    return;
  }
  if (
    (pathname === "/api/auth/sessions" && request.method === "GET") ||
    (pathname.startsWith("/api/auth/sessions/") && request.method === "DELETE")
  ) {
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
        json(response, 401, { error: "Sign in first." });
        return;
      }
      if (request.method === "GET") {
        json(response, 200, {
          sessions: await auth.listSessions(user.id, request),
        });
        return;
      }
      const outcome = await auth.revokeSession(
        user.id,
        pathname.slice("/api/auth/sessions/".length),
        request,
      );
      if (!outcome.revoked) {
        json(response, 404, { error: "Session not found." });
        return;
      }
      json(
        response,
        200,
        { ok: true, current: outcome.current },
        outcome.current ? { "Set-Cookie": auth.clearCookie(request) } : {},
      );
    } catch (error) {
      json(response, error.status || 503, {
        error: error.status ? error.message : "Account service is unavailable.",
      });
    }
    return;
  }
  if (pathname === "/api/usage" && request.method === "GET") {
    if (!validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    try {
      const user = await auth.currentUser(request).catch(() => null);
      const isAdmin = admin.isAdmin(user);
      const limit = isAdmin
        ? { allowed: true }
        : await rateLimit.consume(request, pathname);
      if (!limit.allowed) {
        json(
          response,
          429,
          { error: "Usage is being refreshed too often." },
          { "Retry-After": String(limit.retryAfter) },
        );
        return;
      }
      if (isAdmin) {
        json(response, 200, {
          usage: ["/api/run", "/api/idea-to-prompt", "/api/transcribe"].map(
            (route) => ({ route, unlimited: true }),
          ),
        });
        return;
      }
      const level = await referrals.rewardLevel(user);
      const usage = [];
      for (const route of [
        "/api/run",
        "/api/idea-to-prompt",
        "/api/transcribe",
      ]) {
        usage.push({
          route,
          ...(await rateLimit.peek(
            request,
            route,
            referrals.rateOptions(route, user, level),
          )),
        });
      }
      json(response, 200, { usage });
    } catch (error) {
      json(response, 503, { error: error.message || "Usage is unavailable." });
    }
    return;
  }
  if (
    pathname === "/api/auth/firebase/identities" &&
    request.method === "GET"
  ) {
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
        json(response, 401, { error: "Sign in first." });
        return;
      }
      json(response, 200, await auth.firebaseIdentities(user));
    } catch (error) {
      json(response, error.status || 503, {
        error: error.status
          ? error.message
          : "Provider accounts are unavailable.",
        code: error.code || undefined,
      });
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
      "/api/auth/delete-account",
      "/api/auth/logout-all",
      "/api/auth/firebase",
      "/api/auth/firebase/link/start",
      "/api/auth/firebase/link/complete",
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
        const user = await auth.currentUser(request).catch(() => null);
        const limit = admin.isAdmin(user)
          ? { allowed: true }
          : await rateLimit.consume(request, pathname);
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
      let body;
      if (
        pathname === "/api/auth/firebase" ||
        pathname === "/api/auth/firebase/link/complete"
      ) {
        if (!request.headers["content-type"]?.startsWith("application/json")) {
          json(response, 415, { error: "Use JSON." });
          return;
        }
        body = await readBody(request);
      }
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
      } else if (pathname === "/api/auth/firebase") {
        const result = await auth.firebaseLogin(body, request);
        json(
          response,
          200,
          { user: result.user },
          { "Set-Cookie": result.cookie },
        );
      } else if (pathname === "/api/auth/firebase/link/start") {
        const user = await auth.currentUser(request);
        if (!user) {
          json(response, 401, { error: "Sign in first." });
          return;
        }
        json(response, 200, await auth.firebaseLinkStart(user));
      } else if (pathname === "/api/auth/firebase/link/complete") {
        const user = await auth.currentUser(request);
        if (!user) {
          json(response, 401, { error: "Sign in first." });
          return;
        }
        json(response, 200, await auth.firebaseLinkComplete(user, body));
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
        body = await readBody(request);
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
        } else if (pathname === "/api/auth/delete-account") {
          const user = await auth.currentUser(request);
          if (!user) {
            json(response, 401, { error: "Sign in first." });
            return;
          }
          await auth.deleteAccount(user, body);
          json(
            response,
            200,
            { ok: true },
            { "Set-Cookie": auth.clearCookie(request) },
          );
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
  if (pathname === "/api/settings" || pathname.startsWith("/api/settings/")) {
    const method = request.method;
    if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
      json(response, 405, { error: "Method not allowed." });
      return;
    }
    if (method !== "GET" && !validOrigin(request)) {
      json(response, 403, { error: "Invalid origin." });
      return;
    }
    const wantsBody = method === "POST" || method === "PUT";
    if (
      wantsBody &&
      !request.headers["content-type"]?.startsWith("application/json")
    ) {
      json(response, 415, { error: "Use JSON." });
      return;
    }
    try {
      const user = await auth.currentUser(request);
      if (!user) {
        json(response, 401, { error: "Sign in first." });
        return;
      }
      const body = wantsBody ? await readBody(request) : null;
      if (pathname === "/api/settings") {
        if (method === "GET")
          json(response, 200, await settings.getSettings(user.id));
        else if (method === "PUT")
          json(response, 200, await settings.saveSettings(user.id, body));
        else if (method === "DELETE")
          json(response, 200, await settings.deleteSettings(user.id));
        else json(response, 405, { error: "Method not allowed." });
        return;
      }
      if (pathname === "/api/settings/providers" && method === "POST") {
        json(response, 200, await settings.saveProvider(user.id, body));
        return;
      }
      if (pathname === "/api/settings/active" && method === "POST") {
        json(response, 200, await settings.setActiveProvider(user.id, body));
        return;
      }
      const providerId = pathname.startsWith("/api/settings/providers/")
        ? pathname.slice("/api/settings/providers/".length)
        : null;
      if (providerId && method === "PUT") {
        json(
          response,
          200,
          await settings.saveProvider(user.id, { ...body, providerId }),
        );
        return;
      }
      if (providerId && method === "DELETE") {
        json(response, 200, await settings.removeProvider(user.id, providerId));
        return;
      }
      json(response, 404, { error: "Not found." });
    } catch (error) {
      const status =
        error.status ||
        (/^(Invalid JSON|Request is too large)\./.test(error.message)
          ? 400
          : 0);
      json(response, status || 503, {
        error: status ? error.message : "Settings are unavailable.",
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
        user.username || null,
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
      else if (pathname === "/api/prompts/export" && request.method === "GET")
        json(response, 200, { prompts: await database.exportPrompts(key) });
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
      const limit = admin.isAdmin(user)
        ? { allowed: true }
        : await rateLimit.consume(request, pathname, {
            ...referrals.rateOptions(
              pathname,
              user,
              await referrals.rewardLevel(user),
            ),
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
      const body = await readBody(
        request,
        pathname === "/api/idea-to-prompt" ? 4200000 : 1000000,
      );
      if (pathname === "/api/idea-to-prompt") {
        ai.normalizeIdea(body);
        ai.normalizeIdeaGuidance(body);
        ai.normalizeClarifications(body);
        ai.normalizeImages(body);
      } else if (pathname === "/api/enhance") ai.normalizeDraft(body);
      else ai.normalizeRunInput(body);
      const limit = admin.isAdmin(user)
        ? { allowed: true }
        : await rateLimit.consume(request, pathname, {
            ...referrals.rateOptions(
              pathname,
              user,
              await referrals.rewardLevel(user),
            ),
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
        "Request is too large.",
        "Prepared images are too large for this request.",
      ].includes(message)
        ? 413
        : [
              "Invalid JSON.",
              "Add a task before enhancing.",
              "Describe your idea in a few words.",
              "Invalid fine-tune details.",
              "Invalid clarification answers.",
              "Attach up to three images.",
              "Use JPEG, PNG, or WebP images.",
              "Invalid image data.",
              "The selected provider needs a vision model in Settings before it can analyze images.",
              "Add a task before running the prompt.",
            ].includes(message)
          ? 400
          : 503;
      json(response, status, {
        error:
          pathname === "/api/idea-to-prompt" &&
          message === "Request is too large."
            ? "This request exceeds the upload limit. Refresh the page and try again; images are now optimized before sending."
            : message,
      });
    }
    return;
  }
  json(response, 404, { error: "Not found." });
}

module.exports = handleBackendRequest;
