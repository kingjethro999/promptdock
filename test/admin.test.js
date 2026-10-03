const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_ADMIN_EMAIL,
  adminEmail,
  isAdmin,
} = require("../src/admin-server");

function withAdminEmail(value, run) {
  const previous = process.env.ADMIN_EMAIL;
  if (value === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previous;
  }
}

test("ADMIN_EMAIL unset keeps the built-in administrator address", () => {
  withAdminEmail(undefined, () => {
    assert.equal(adminEmail(), DEFAULT_ADMIN_EMAIL);
    assert.equal(isAdmin({ email: DEFAULT_ADMIN_EMAIL }), true);
    assert.equal(
      isAdmin({ email: `  ${DEFAULT_ADMIN_EMAIL.toUpperCase()} ` }),
      true,
    );
    assert.equal(isAdmin({ email: "reader@example.com" }), false);
  });
});

test("ADMIN_EMAIL set replaces the built-in administrator address", () => {
  withAdminEmail(" Ops@Example.COM ", () => {
    assert.equal(adminEmail(), "ops@example.com");
    assert.equal(isAdmin({ email: "ops@example.com" }), true);
    assert.equal(isAdmin({ email: DEFAULT_ADMIN_EMAIL }), false);
  });
});

test("accounts without an email address are never administrators", () => {
  withAdminEmail(undefined, () => {
    assert.equal(isAdmin(null), false);
    assert.equal(isAdmin(undefined), false);
    assert.equal(isAdmin({ id: "user-1" }), false);
    assert.equal(isAdmin({ email: "   " }), false);
  });
});
