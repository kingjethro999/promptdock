const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "qa", "ui-after");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUTES = [
  { name: "landing", path: "/" },
  { name: "auth-login", path: "/auth?mode=login" },
  { name: "auth-register", path: "/auth?mode=register" },
  { name: "community", path: "/community" },
  { name: "updates", path: "/updates" },
  { name: "privacy", path: "/privacy" },
];

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
  { name: "desktop-1366", width: 1366, height: 768, isMobile: false },
];

const THEMES = ["light", "dark"];

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
  });

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        colorScheme: theme,
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        try {
          const url = `http://localhost:3000${route.path}`;
          await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
          if (theme === "dark") {
            await page.evaluate(() => {
              document.documentElement.setAttribute("data-theme", "dark");
              document.documentElement.classList.add("dark");
            });
          } else {
            await page.evaluate(() => {
              document.documentElement.setAttribute("data-theme", "light");
              document.documentElement.classList.remove("dark");
            });
          }
          await page.waitForTimeout(300);
          const filename = `${route.name}-${vp.name}-${theme}.png`;
          await page.screenshot({
            path: path.join(OUT_DIR, filename),
            fullPage: false,
          });
          console.log(`Saved: ${filename}`);
        } catch (err) {
          console.error(`Failed ${route.name} (${vp.name}, ${theme}):`, err.message);
        }
      }
      await context.close();
    }
  }

  await browser.close();
  console.log("All before screenshots captured successfully.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
