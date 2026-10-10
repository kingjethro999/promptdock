const { chromium } = require("playwright");
const path = require("path");

const QA_DIR =
  "/home/king/.gemini/antigravity-ide/brain/3f458dbb-c4f5-4ffa-b718-41bdb401e18d/qa";

async function runQA() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
  });

  const viewports = [
    { name: "1-desktop-wide", width: 1440, height: 900, isMobile: false },
    { name: "2-laptop", width: 1280, height: 800, isMobile: false },
    { name: "3-tablet", width: 768, height: 1024, isMobile: true },
    { name: "4-mobile-portrait", width: 390, height: 844, isMobile: true },
    { name: "5-mobile-landscape", width: 844, height: 390, isMobile: true },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Scroll through the page to trigger reveals
    await page.evaluate(async () => {
      window.scrollTo({
        top: document.body.scrollHeight / 2,
        behavior: "smooth",
      });
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo({ top: 0, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 400));
    });

    await page.screenshot({ path: path.join(QA_DIR, `${vp.name}-hero.png`) });
    await page.screenshot({
      path: path.join(QA_DIR, `${vp.name}-full.png`),
      fullPage: true,
    });

    // Check horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    console.log(
      `Viewport ${vp.name}: horizontal overflow = ${hasHorizontalOverflow}, page errors = ${errors.length}`,
    );
    await context.close();
  }

  // Test 6: Interactive Demo Hover & Liquid Wave Loading
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    const demo = page.locator(".landing-demo");
    const shapeButton = page.locator(".demo-action-container .liquid-button");

    // Hover over demo to test 3D perspective & glare
    const box = await demo.boundingBox();
    if (box) {
      await page.mouse.move(
        box.x + box.width * 0.75,
        box.y + box.height * 0.25,
      );
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(QA_DIR, "6-demo-hover-3d-tilt.png"),
      });
    }

    // Click shape button to trigger liquid wave animation
    await shapeButton.click();
    // Capture mid-wave animation (approx 250ms in)
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(QA_DIR, "7-liquid-button-wave-loading.png"),
    });

    // Capture post-synthesis settled state
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(QA_DIR, "8-demo-settled-after-synthesis.png"),
    });

    await context.close();
  }

  // Test 7: Reduced Motion Mode
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    await page.screenshot({
      path: path.join(QA_DIR, "9-reduced-motion-hero.png"),
    });
    await context.close();
  }

  // Test 8: Feedback Dialog with Liquid Button
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Open feedback dialog from footer
    await page.locator(".landing-footer-actions button").click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(QA_DIR, "10-feedback-dialog-open.png"),
    });

    await context.close();
  }

  console.log("All QA tests completed successfully!");
  await browser.close();
}

runQA().catch((err) => {
  console.error(err);
  process.exit(1);
});
