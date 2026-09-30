const {
  createHash,
  randomBytes,
  randomUUID,
  scrypt: callbackScrypt,
  timingSafeEqual,
} = require("node:crypto");
const { promisify } = require("node:util");
const database = require("./database");
const mailer = require("./mailer");

const scrypt = promisify(callbackScrypt);
const COOKIE = "promptdock_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

class AuthError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function emailFrom(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthError("Enter a valid email address.");
  return email;
}

function passwordFrom(value, registering = false) {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    (registering && value.length < 12)
  )
    throw new AuthError(
      registering
        ? "Use a password of at least 12 characters."
        : "Invalid email or password.",
      registering ? 400 : 401,
    );
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, Buffer.from(salt, "hex"), 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = String(encoded).split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(expected || "")
  )
    return false;
  const actual = await scrypt(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function tokenFrom(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(
    /(?:^|;\s*)promptdock_session=([a-f0-9]{64})(?:;|$)/,
  );
  return match?.[1] || null;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieHeader(token, request) {
  const secure =
    request.headers["x-forwarded-proto"] === "https" ||
    request.socket?.encrypted;
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

function clearCookie(request) {
  return cookieHeader("", request).replace(
    `Max-Age=${SESSION_SECONDS}`,
    "Max-Age=0",
  );
}

async function issueSession(user, request) {
  const token = randomBytes(32).toString("hex");
  await database.pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [tokenHash(token), user.id],
  );
  return {
    user: { id: user.id, email: user.email },
    cookie: cookieHeader(token, request),
  };
}

function rawToken(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new AuthError("This link is invalid or expired.", 400);
  return value;
}

async function sendToken(user, purpose) {
  if (!mailer.configured())
    throw new AuthError("Email delivery is not configured.", 503);
  const recent = await database.pool.query(
    `SELECT created_at FROM auth_tokens
    WHERE user_id = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
    [user.id, purpose],
  );
  if (
    recent.rows[0] &&
    Date.now() - new Date(recent.rows[0].created_at).getTime() < 60000
  )
    return;
  const token = randomBytes(32).toString("hex");
  const hash = tokenHash(token);
  await database.pool.query(
    "DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2",
    [user.id, purpose],
  );
  await database.pool.query(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
    VALUES ($1, $2, $3, now() + ($4::integer * interval '1 hour'))`,
    [hash, user.id, purpose, purpose === "verify" ? 24 : 1],
  );
  try {
    await mailer.sendAuthLink(user.email, purpose, token);
  } catch {
    await database.pool.query("DELETE FROM auth_tokens WHERE token_hash = $1", [
      hash,
    ]);
    throw new AuthError(
      "Could not send the email. Try again shortly.",
      503,
      "email_delivery_failed",
    );
  }
}

async function register(body) {
  const email = emailFrom(body?.email);
  const password = passwordFrom(body?.password, true);
  await database.ensureSchema();
  try {
    const result = await database.pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email",
      [randomUUID(), email, await hashPassword(password)],
    );
    await sendToken(result.rows[0], "verify");
    return { pending: true, email };
  } catch (error) {
    if (error.code === "23505")
      throw new AuthError("An account with this email already exists.", 409);
    throw error;
  }
}

async function login(body, request) {
  const email = emailFrom(body?.email);
  const password = passwordFrom(body?.password);
  await database.ensureSchema();
  const result = await database.pool.query(
    "SELECT id, email, password_hash, failed_logins, locked_until, email_verified_at FROM users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];
  if (user?.locked_until && new Date(user.locked_until) > new Date())
    throw new AuthError("Too many attempts. Try again in 15 minutes.", 429);
  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(
        password,
        "scrypt$00000000000000000000000000000000$" + "0".repeat(128),
      );
  if (!user || !valid) {
    if (user)
      await database.pool.query(
        `UPDATE users SET failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE id = $1`,
        [user.id],
      );
    throw new AuthError("Invalid email or password.", 401);
  }
  await database.pool.query(
    "UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1",
    [user.id],
  );
  if (!user.email_verified_at)
    throw new AuthError(
      "Verify your email before signing in.",
      403,
      "verification_required",
    );
  return issueSession(user, request);
}

async function resendVerification(body) {
  const email = emailFrom(body?.email);
  await database.ensureSchema();
  if (!mailer.configured())
    throw new AuthError("Email delivery is not configured.", 503);
  const result = await database.pool.query(
    "SELECT id, email FROM users WHERE email = $1 AND email_verified_at IS NULL",
    [email],
  );
  if (result.rows[0]) {
    try {
      await sendToken(result.rows[0], "verify");
    } catch {
      console.warn("Verification email could not be sent.");
    }
  }
  return { ok: true };
}

async function forgotPassword(body) {
  const email = emailFrom(body?.email);
  await database.ensureSchema();
  if (!mailer.configured())
    throw new AuthError("Email delivery is not configured.", 503);
  const result = await database.pool.query(
    "SELECT id, email FROM users WHERE email = $1",
    [email],
  );
  if (result.rows[0]) {
    try {
      await sendToken(result.rows[0], "reset");
    } catch {
      console.warn("Password reset email could not be sent.");
    }
  }
  return { ok: true };
}

async function consumeToken(value, purpose, password = null) {
  const token = rawToken(value);
  const encoded =
    purpose === "reset"
      ? await hashPassword(passwordFrom(password, true))
      : null;
  await database.ensureSchema();
  const client = await database.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT user_id FROM auth_tokens
      WHERE token_hash = $1 AND purpose = $2 AND expires_at > now() FOR UPDATE`,
      [tokenHash(token), purpose],
    );
    if (!result.rows[0])
      throw new AuthError("This link is invalid or expired.", 400);
    const userId = result.rows[0].user_id;
    if (purpose === "verify")
      await client.query(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
        [userId],
      );
    else {
      await client.query(
        "UPDATE users SET password_hash = $1, failed_logins = 0, locked_until = NULL, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2",
        [encoded, userId],
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    }
    await client.query(
      "DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2",
      [userId, purpose],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function changePassword(user, body, request) {
  const current = passwordFrom(body?.currentPassword);
  const replacement = passwordFrom(body?.newPassword, true);
  await database.ensureSchema();
  const result = await database.pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [user.id],
  );
  if (
    !result.rows[0] ||
    !(await verifyPassword(current, result.rows[0].password_hash))
  )
    throw new AuthError("Current password is incorrect.", 401);
  const encoded = await hashPassword(replacement);
  await database.pool.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2",
    [encoded, user.id],
  );
  await database.pool.query("DELETE FROM sessions WHERE user_id = $1", [
    user.id,
  ]);
  return issueSession(user, request);
}

async function logoutAll(userId) {
  await database.ensureSchema();
  await database.pool.query("DELETE FROM sessions WHERE user_id = $1", [
    userId,
  ]);
}

async function currentUser(request) {
  const token = tokenFrom(request);
  if (!token || !database.pool) return null;
  await database.ensureSchema();
  const result = await database.pool.query(
    `SELECT users.id, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = $1 AND sessions.expires_at > now() AND users.email_verified_at IS NOT NULL`,
    [tokenHash(token)],
  );
  return result.rows[0] || null;
}

async function logout(request) {
  const token = tokenFrom(request);
  if (token && database.pool) {
    await database.ensureSchema();
    await database.pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      tokenHash(token),
    ]);
  }
}

module.exports = {
  AuthError,
  emailFrom,
  hashPassword,
  verifyPassword,
  tokenFrom,
  cookieHeader,
  clearCookie,
  register,
  login,
  resendVerification,
  forgotPassword,
  consumeToken,
  changePassword,
  logoutAll,
  currentUser,
  logout,
};
