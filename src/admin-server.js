const DEFAULT_ADMIN_EMAIL = "king18jsquare@gmail.com";

function adminEmail(env = process.env) {
  return String(env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase();
}

function isAdmin(user, env = process.env) {
  return Boolean(
    user?.email && user.email.trim().toLowerCase() === adminEmail(env),
  );
}

module.exports = { DEFAULT_ADMIN_EMAIL, adminEmail, isAdmin };
