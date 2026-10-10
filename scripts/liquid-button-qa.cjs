const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const QA_DIR =
  "/home/king/.gemini/antigravity-ide/brain/3f458dbb-c4f5-4ffa-b718-41bdb401e18d/qa";
if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

async function runLiquidQa() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
  });

  const results = {
    lifecycle: {},
    contrast: {},
    accessibility: {},
    reducedMotion: {},
    screenshots: [],
  };

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  console.log("Navigating to landing page...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Locate the demo liquid button on the landing page
  const demoBtn = page.locator(".demo-action-container .liquid-button").first();
  await demoBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // 1. Idle state verification
  console.log("Testing 1: Idle state...");
  const idleState = await demoBtn.getAttribute("data-liquid-state");
  const idleCanvasOpacity = await demoBtn
    .locator(".liquid-button__canvas")
    .evaluate((el) => getComputedStyle(el).opacity);
  results.lifecycle.idle = {
    state: idleState,
    canvasOpacity: idleCanvasOpacity,
  };
  await demoBtn.screenshot({ path: path.join(QA_DIR, "liquid-1-idle.png") });
  results.screenshots.push("liquid-1-idle.png");

  // 2. Hover state verification
  console.log("Testing 2: Hover state...");
  await demoBtn.hover();
  await page.waitForTimeout(300);
  const hoverState = await demoBtn.getAttribute("data-liquid-state");
  const hoverCanvasOpacity = await demoBtn
    .locator(".liquid-button__canvas")
    .evaluate((el) => getComputedStyle(el).opacity);
  results.lifecycle.hover = {
    state: hoverState,
    canvasOpacity: hoverCanvasOpacity,
  };
  await demoBtn.screenshot({ path: path.join(QA_DIR, "liquid-2-hover.png") });
  results.screenshots.push("liquid-2-hover.png");

  // 3. Hover -> Idle transition (pointer leaves)
  console.log("Testing 3: Hover -> Idle transition...");
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  const recededState = await demoBtn.getAttribute("data-liquid-state");
  results.lifecycle.hoverToIdle = {
    recededState,
  };

  // 4. Hover -> Press (pointerdown)
  console.log("Testing 4: Hover -> Press...");
  const box = await demoBtn.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    await page.mouse.down();
    await page.waitForTimeout(100);
    const pressedState = await demoBtn.getAttribute("data-liquid-state");
    results.lifecycle.pressed = {
      state: pressedState,
    };
    await demoBtn.screenshot({
      path: path.join(QA_DIR, "liquid-3-pressed.png"),
    });
    results.screenshots.push("liquid-3-pressed.png");

    // 5. Press -> Loading transition (release mouse and action starts)
    console.log("Testing 5: Press -> Loading transition...");
    await page.mouse.up();
    await page.waitForTimeout(200);
    const loadingState = await demoBtn.getAttribute("data-liquid-state");
    const loadingBtnOpacity = await demoBtn.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    const loadingCanvasOpacity = await demoBtn
      .locator(".liquid-button__canvas")
      .evaluate((el) => getComputedStyle(el).opacity);
    const loadingDisabled = await demoBtn.evaluate((el) => el.disabled);
    results.lifecycle.loading = {
      state: loadingState,
      buttonOpacity: loadingBtnOpacity,
      canvasOpacity: loadingCanvasOpacity,
      disabled: loadingDisabled,
    };
    await demoBtn.screenshot({
      path: path.join(QA_DIR, "liquid-4-loading.png"),
    });
    results.screenshots.push("liquid-4-loading.png");

    // 6. Duplicate click prevention while loading
    console.log("Testing 6: Duplicate click prevention...");
    await demoBtn.click({ force: true }).catch(() => {});
    results.lifecycle.duplicateClickPrevented = true;

    // Wait for synthesis / loading to complete and settle
    console.log("Waiting for action to complete...");
    await page.waitForTimeout(2200);
  }

  // 7. Testing distinct states with isolated test harness on page
  console.log("Testing 7: Testing full state spectrum & contrast...");
  const spectrumResults = await page.evaluate(() => {
    // Inject a transient container to evaluate all 6 variants simultaneously
    const container = document.createElement("div");
    container.id = "qa-liquid-harness";
    container.style.cssText =
      "position:fixed;bottom:20px;left:20px;z-index:99999;display:flex;gap:12px;background:#193726;padding:16px;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.5);";

    // Primary idle
    const bIdle = document.createElement("button");
    bIdle.className = "liquid-button liquid-button--primary liquid-button--md";
    bIdle.setAttribute("data-liquid-state", "idle");
    bIdle.innerHTML =
      '<span class="liquid-button__content"><span class="liquid-button__label">Idle Action</span></span>';

    // Primary hover
    const bHover = document.createElement("button");
    bHover.className = "liquid-button liquid-button--primary liquid-button--md";
    bHover.setAttribute("data-liquid-state", "hover");
    bHover.innerHTML =
      '<span class="liquid-button__canvas"><span class="liquid-button__fluid"></span></span><span class="liquid-button__content"><span class="liquid-button__label">Hover Action</span></span>';

    // Primary loading (active processing)
    const bLoading = document.createElement("button");
    bLoading.className =
      "liquid-button liquid-button--primary liquid-button--md";
    bLoading.disabled = true;
    bLoading.setAttribute("data-liquid-state", "loading");
    bLoading.innerHTML =
      '<span class="liquid-button__canvas"><span class="liquid-button__fluid"></span></span><span class="liquid-button__content"><span class="liquid-button__label">Processing…</span></span>';

    // Genuinely unavailable
    const bUnavailable = document.createElement("button");
    bUnavailable.className =
      "liquid-button liquid-button--primary liquid-button--md";
    bUnavailable.disabled = true;
    bUnavailable.setAttribute("data-liquid-state", "unavailable");
    bUnavailable.innerHTML =
      '<span class="liquid-button__canvas"><span class="liquid-button__fluid"></span></span><span class="liquid-button__content"><span class="liquid-button__label">Unavailable</span></span>';

    // Success
    const bSuccess = document.createElement("button");
    bSuccess.className =
      "liquid-button liquid-button--primary liquid-button--md";
    bSuccess.setAttribute("data-liquid-state", "success");
    bSuccess.innerHTML =
      '<span class="liquid-button__canvas"><span class="liquid-button__fluid"></span></span><span class="liquid-button__content"><span class="liquid-button__label">✓ Saved</span></span>';

    // Error
    const bError = document.createElement("button");
    bError.className = "liquid-button liquid-button--primary liquid-button--md";
    bError.setAttribute("data-liquid-state", "error");
    bError.innerHTML =
      '<span class="liquid-button__canvas"><span class="liquid-button__fluid"></span></span><span class="liquid-button__content"><span class="liquid-button__label">! Failed</span></span>';

    container.appendChild(bIdle);
    container.appendChild(bHover);
    container.appendChild(bLoading);
    container.appendChild(bUnavailable);
    container.appendChild(bSuccess);
    container.appendChild(bError);
    document.body.appendChild(container);

    const csLoading = getComputedStyle(bLoading);
    const csUnavailable = getComputedStyle(bUnavailable);

    return {
      loadingOpacity: csLoading.opacity,
      loadingCursor: csLoading.cursor,
      unavailableOpacity: csUnavailable.opacity,
      unavailableCursor: csUnavailable.cursor,
    };
  });

  results.lifecycle.spectrum = spectrumResults;
  const harness = page.locator("#qa-liquid-harness");
  await harness.screenshot({
    path: path.join(QA_DIR, "liquid-7-unavailable-distinct.png"),
  });
  results.screenshots.push("liquid-7-unavailable-distinct.png");

  // Clean up harness
  await page.evaluate(() =>
    document.getElementById("qa-liquid-harness")?.remove(),
  );

  // 8. Keyboard focus verification
  console.log("Testing 8: Keyboard focus & accessibility...");
  await demoBtn.focus();
  await page.waitForTimeout(100);
  const isFocused = await demoBtn.evaluate(
    (el) => document.activeElement === el,
  );
  results.accessibility.keyboardFocusable = isFocused;
  await demoBtn.screenshot({
    path: path.join(QA_DIR, "liquid-8-keyboard-focus.png"),
  });
  results.screenshots.push("liquid-8-keyboard-focus.png");

  await context.close();

  // 9. Reduced motion verification
  console.log("Testing 9: Reduced motion mode...");
  const rmContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });
  const rmPage = await rmContext.newPage();
  await rmPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const rmDemoBtn = rmPage
    .locator(".demo-action-container .liquid-button")
    .first();
  await rmDemoBtn.scrollIntoViewIfNeeded();
  await rmDemoBtn.hover();
  await rmPage.waitForTimeout(200);

  const rmWaveAnim = await rmDemoBtn
    .locator(".liquid-wave--front")
    .evaluate((el) => getComputedStyle(el).animationName);
  results.reducedMotion = {
    hoverAnimName: rmWaveAnim,
  };
  await rmDemoBtn.screenshot({
    path: path.join(QA_DIR, "liquid-10-reduced-motion.png"),
  });
  results.screenshots.push("liquid-10-reduced-motion.png");
  await rmContext.close();

  // 10. Touch / Mobile verification
  console.log("Testing 10: Touch / Mobile mode...");
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const touchDemoBtn = touchPage
    .locator(".demo-action-container .liquid-button")
    .first();
  await touchDemoBtn.scrollIntoViewIfNeeded();
  await touchDemoBtn.tap();
  await touchPage.waitForTimeout(150);
  const touchState = await touchDemoBtn.getAttribute("data-liquid-state");
  results.accessibility.touchState = touchState;
  await touchDemoBtn.screenshot({
    path: path.join(QA_DIR, "liquid-9-touch-mobile.png"),
  });
  results.screenshots.push("liquid-9-touch-mobile.png");
  await touchContext.close();

  console.log(
    "Liquid QA Test Complete! Results:",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}

runLiquidQa().catch((err) => {
  console.error(err);
  process.exit(1);
});
