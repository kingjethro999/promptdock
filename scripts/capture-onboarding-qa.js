/* global document */
process.loadEnvFile(".env");
const { chromium } = require("playwright");
const crypto = require("node:crypto");
const path = require("node:path");
const db = require("../src/database");

async function main() {
  await db.ensureSchema();
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
  });

  const viewports = [
    { name: "desktop", width: 1366, height: 768 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    for (const theme of ["light", "dark"]) {
      const tokenBytes = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(tokenBytes)
        .digest("hex");
      const userId = crypto.randomUUID();
      const username = "tester_" + Math.random().toString(36).substring(2, 7);

      await db.pool.query(
        `INSERT INTO users (id, email, username, display_name, email_verified_at, created_at)
         VALUES ($1, $2, $3, $4, now(), now())`,
        [userId, `${username}@example.com`, username, "Tester User"],
      );

      await db.pool.query(
        `INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, now() + interval '1 day')`,
        [tokenHash, userId],
      );

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });

      await context.addCookies([
        {
          name: "promptdock_session",
          value: tokenBytes,
          domain: "localhost",
          path: "/",
        },
      ]);

      const page = await context.newPage();

      // Go to /welcome
      await page.goto("http://localhost:3000/welcome", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
        if (t === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
      }, theme);
      await page.waitForTimeout(600);

      // Screenshot Step 1 (Name)
      await page.screenshot({
        path: path.join(
          __dirname,
          `../qa/profile-setup/step1-${vp.name}-${theme}.png`,
        ),
      });

      // Advance to Step 2 (Photo)
      const continueBtn = page.locator("button:has-text('Continue')");
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(
            __dirname,
            `../qa/profile-setup/step2-${vp.name}-${theme}.png`,
          ),
        });

        // Advance to Step 3 (Cover)
        const nextBtn = page.locator(
          "button:has-text('Continue'), button:has-text('Skip for now')",
        );
        await nextBtn.first().click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(
            __dirname,
            `../qa/profile-setup/step3-${vp.name}-${theme}.png`,
          ),
        });

        // Advance to Step 4 (Bio)
        await nextBtn.first().click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(
            __dirname,
            `../qa/profile-setup/step4-${vp.name}-${theme}.png`,
          ),
        });

        // Advance to Step 5 (Done)
        await nextBtn.first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: path.join(
            __dirname,
            `../qa/profile-setup/step5-${vp.name}-${theme}.png`,
          ),
        });
      }

      await context.close();
    }
  }

  // Also capture the Workspace guided tour
  // Mark profile setup completed so user lands in workspace with pending welcome-v1 tour
  const tourUserId = crypto.randomUUID();
  const tourTokenBytes = crypto.randomBytes(32).toString("hex");
  const tourTokenHash = crypto
    .createHash("sha256")
    .update(tourTokenBytes)
    .digest("hex");
  const tourUsername = "tour_" + Math.random().toString(36).substring(2, 7);

  await db.pool.query(
    `INSERT INTO users (id, email, username, display_name, email_verified_at, created_at)
     VALUES ($1, $2, $3, $4, now(), now())`,
    [tourUserId, `${tourUsername}@example.com`, tourUsername, "Tour User"],
  );

  await db.pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '1 day')`,
    [tourTokenHash, tourUserId],
  );

  await db.pool.query(
    `INSERT INTO user_experiences (user_id, experience_id, status, step_reached)
     VALUES ($1, 'profile-setup-v1', 'completed', 5)
     ON CONFLICT (user_id, experience_id) DO UPDATE SET status = 'completed'`,
    [tourUserId],
  );

  for (const theme of ["light", "dark"]) {
    await db.pool.query(
      `DELETE FROM user_experiences WHERE user_id = $1 AND experience_id = 'welcome-v1'`,
      [tourUserId],
    );

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      colorScheme: theme,
    });
    await context.addCookies([
      {
        name: "promptdock_session",
        value: tourTokenBytes,
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await context.newPage();
    await page.goto("http://localhost:3000/workspace", {
      waitUntil: "networkidle",
    });
    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      if (t === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }, theme);

    // Wait for the quiet timer and tour card to appear
    try {
      await page.waitForSelector(".tour-card", { timeout: 10000 });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(__dirname, `../qa/onboarding/tour-step1-${theme}.png`),
      });

      // Click Next on tour
      const nextBtn = page.locator(".tour-card button:has-text('Next')");
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: path.join(
            __dirname,
            `../qa/onboarding/tour-step2-spotlight-${theme}.png`,
          ),
        });
      }
    } catch (e) {
      console.log("Tour screenshot note:", e.message);
    }
    await context.close();
  }

  await browser.close();
  console.log("QA Screenshots captured successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
