const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const QA_DIR = '/home/king/.gemini/antigravity-ide/brain/3f458dbb-c4f5-4ffa-b718-41bdb401e18d/qa';
if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'wide', width: 1920, height: 1080, hasTouch: false },
  { name: 'laptop', width: 1366, height: 768, hasTouch: false },
  { name: 'tablet', width: 820, height: 1180, hasTouch: true },
  { name: 'mobile', width: 390, height: 844, hasTouch: true },
  { name: 'mobile-landscape', width: 844, height: 390, hasTouch: true },
];

async function installMetrics(page) {
  await page.addInitScript(() => {
    const w = window;
    w.__m = { cls: 0, lcp: 0, longTaskMs: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) w.__m.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      const es = l.getEntries();
      if (es.length > 0) w.__m.lcp = es[es.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__m.longTaskMs += e.duration;
    }).observe({ type: 'longtask', buffered: true });
  });
}

async function scrollSlowly(page, step = 280, pause = 140) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= total + step; y += step) {
    await page.evaluate((s) => window.scrollBy(0, s), step);
    await page.waitForTimeout(pause);
  }
}

async function flingToBottom(page) {
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(16);
  }
}

const hiddenCount = (page) => page.locator("[data-reveal-phase='hidden']").count();

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  });

  const results = {
    viewports: {},
    reducedMotion: {},
    noJs: {},
    filmstrip: [],
  };

  // Test across all 5 viewports
  for (const vp of VIEWPORTS) {
    console.log(`Testing viewport: ${vp.name}...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();
    await installMetrics(page);
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Test 1: Slow scroll
    await scrollSlowly(page);
    await page.waitForTimeout(1200);

    const hiddenAfterSlow = await hiddenCount(page);
    const hasNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const metrics = await page.evaluate(() => window.__m || { cls: 0, lcp: 0, longTaskMs: 0 });

    const notIdentity = await page.$$eval(
      "[data-reveal-phase='visible'], [data-reveal-phase='instant']",
      (els) => els.filter((e) => getComputedStyle(e).transform !== 'none').length
    );

    // Test 2: Fast fling
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await flingToBottom(page);
    await page.waitForTimeout(1200);
    const hiddenAfterFling = await hiddenCount(page);

    // Test 3: Jump bottom then top
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const hiddenAfterJump = await hiddenCount(page);

    // Test 4: Keyboard focus
    let focusTrappedInHidden = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(40);
      const isHidden = await page.evaluate(() => !!document.activeElement?.closest("[data-reveal-phase='hidden']"));
      if (isHidden) {
        focusTrappedInHidden = true;
        break;
      }
    }

    // Capture screenshots
    await page.screenshot({ path: path.join(QA_DIR, `addendum-${vp.name}-hero.png`) });
    await page.screenshot({ path: path.join(QA_DIR, `addendum-${vp.name}-full.png`), fullPage: true });

    results.viewports[vp.name] = {
      hiddenAfterSlow,
      hasNoOverflow,
      cls: metrics.cls,
      lcp: metrics.lcp,
      longTaskMs: metrics.longTaskMs,
      notIdentity,
      hiddenAfterFling,
      hiddenAfterJump,
      focusTrappedInHidden,
    };

    console.log(`Viewport ${vp.name} results:`, results.viewports[vp.name]);
    await context.close();
  }

  // Test 5: Reduced Motion
  {
    console.log('Testing reduced motion...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await scrollSlowly(page, 400, 60);
    await page.waitForTimeout(600);

    const hidden = await hiddenCount(page);
    const pinSpacerCount = await page.locator('.pin-spacer').count();
    const movingCount = await page.$$eval(
      "[data-reveal], [data-reveal-item]",
      (els) => els.filter((e) => getComputedStyle(e).transform !== 'none').length
    );

    await page.screenshot({ path: path.join(QA_DIR, 'addendum-reduced-motion.png'), fullPage: true });

    results.reducedMotion = { hidden, pinSpacerCount, movingCount };
    console.log('Reduced motion results:', results.reducedMotion);
    await context.close();
  }

  // Test 6: No JavaScript
  {
    console.log('Testing no JavaScript...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const fadedCount = await page.$$eval(
      "[data-reveal], [data-reveal-item]",
      (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length
    );

    await page.screenshot({ path: path.join(QA_DIR, 'addendum-no-js.png'), fullPage: true });

    results.noJs = { fadedCount };
    console.log('No-JS results:', results.noJs);
    await context.close();
  }

  // Test 7: Filmstrip of each reveal kind
  {
    console.log('Capturing filmstrip of reveal kinds...');
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const kinds = ['mask', 'rise', 'settle', 'depth', 'edge'];
    for (const k of kinds) {
      const el = page.locator(`[data-reveal='${k}'], [data-reveal-item='${k}']`).first();
      const count = await el.count();
      if (count > 0) {
        await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
        for (const [i, wait] of [0, 120, 120, 240, 420].entries()) {
          await page.waitForTimeout(wait);
          const fname = `filmstrip-${k}-${i}.png`;
          await page.screenshot({ path: path.join(QA_DIR, fname) });
          results.filmstrip.push(fname);
        }
      }
    }
    await context.close();
  }

  console.log('QA run finished! Summary:', JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
