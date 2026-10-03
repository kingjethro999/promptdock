const nodemailer = require("nodemailer");

function sender(env = process.env) {
  return env.GMAIL_USER || env.GMAIL_SMTP_USER;
}
function configured(env = process.env) {
  return Boolean(sender(env) && env.GMAIL_APP_PASSWORD);
}

function appUrl(env = process.env) {
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const value =
    env.APP_URL ||
    (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("APP_URL must use HTTP or HTTPS.");
  if (env.VERCEL && url.protocol !== "https:")
    throw new Error("APP_URL must use HTTPS in production.");
  return url.origin;
}

function authLink(purpose, token, env = process.env) {
  const url = new URL(appUrl(env));
  url.searchParams.set(purpose === "verify" ? "verify" : "reset", token);
  return url.toString();
}

async function sendAuthLink(email, purpose, token, env = process.env) {
  if (!configured(env)) throw new Error("Email delivery is not configured.");
  const link = authLink(purpose, token, env);
  const subject =
    purpose === "verify"
      ? "Verify your PromptDock email"
      : "Reset your PromptDock password";
  const action =
    purpose === "verify" ? "Verify your email" : "Reset your password";
  const expiry = purpose === "verify" ? "24 hours" : "1 hour";
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: sender(env), pass: env.GMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transporter.sendMail({
    from: { name: "PromptDock", address: sender(env) },
    to: email,
    subject,
    text: `${action}: ${link}\n\nThis link expires in ${expiry}. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;color:#193026"><h1 style="font-size:24px">PromptDock</h1><p>${action} to continue.</p><p><a href="${link.replaceAll("&", "&amp;")}" style="display:inline-block;background:#20382b;color:#fff;padding:13px 19px;border-radius:8px;text-decoration:none">${action}</a></p><p>This link expires in ${expiry}. If you did not request this, you can ignore this email.</p></div>`,
  });
}

async function sendFeedbackEmail(feedback, env = process.env) {
  if (!configured(env)) throw new Error("Email delivery is not configured.");
  const recipient = env.ADMIN_EMAIL || "king18jsquare@gmail.com";
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: sender(env), pass: env.GMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transporter.sendMail({
    from: { name: "PromptDock feedback", address: sender(env) },
    to: recipient,
    subject: `[PromptDock feedback] ${feedback.kind}`,
    text: `${feedback.message}\n\nReply email: ${feedback.contactEmail || "Not provided"}`,
  });
}

module.exports = {
  configured,
  appUrl,
  authLink,
  sendAuthLink,
  sendFeedbackEmail,
};
