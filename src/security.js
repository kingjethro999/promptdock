const securityHeaders = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src https://github.com; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
});

module.exports = securityHeaders;
