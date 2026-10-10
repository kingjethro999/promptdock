const { chromium } = require("playwright");
const path = require("path");

const QA_DIR =
  "/home/king/.gemini/antigravity-ide/brain/3f458dbb-c4f5-4ffa-b718-41bdb401e18d/qa";

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
  });

  // Desktop
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  const consoleMessages = [];
  desktopPage.on("console", (msg) => consoleMessages.push(msg.text()));

  await desktopPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await desktopPage.screenshot({
    path: path.join(QA_DIR, "current-desktop-hero.png"),
  });
  await desktopPage.screenshot({
    path: path.join(QA_DIR, "current-desktop-full.png"),
    fullPage: true,
  });

  // Mobile
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await mobilePage.screenshot({
    path: path.join(QA_DIR, "current-mobile-full.png"),
    fullPage: true,
  });

  console.log("Screenshots saved to", QA_DIR);
  console.log("Console messages:", consoleMessages.slice(0, 10));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
