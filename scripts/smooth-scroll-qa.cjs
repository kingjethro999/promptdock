const { chromium } = require('playwright');
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

async function settle(page, timeout = 4000) {
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        let last = window.scrollY;
        let t = performance.now();
        const tick = () => {
          if (window.scrollY !== last) {
            last = window.scrollY;
            t = performance.now();
          }
          if (performance.now() - t > 150) resolve(true);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
    null,
    { timeout }
  );
}

async function wheelScroll(page, steps = 60, dy = 120, gap = 16) {
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(gap);
  }
}

async function measureFrames(page, action) {
  await page.evaluate(() => {
    const w = window;
    w.__f = { d: [], run: true, loaf: 0 };
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__f.loaf += e.duration;
      }).observe({ type: 'long-animation-frame', buffered: true });
    } catch {}
    let last = performance.now();
    const loop = (t) => {
      if (!w.__f.run) return;
      w.__f.d.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await action();
  return page.evaluate(() => {
    const w = window;
    w.__f.run = false;
    const d = [...w.__f.d].slice(1).sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
    const droppedCount = d.filter((x) => x > 33.4).length;
    return {
      frames: d.length,
      p50: Number((q(0.5) || 0).toFixed(2)),
      p95: Number((q(0.95) || 0).toFixed(2)),
      p99: Number((q(0.99) || 0).toFixed(2)),
      dropped: Number((d.length > 0 ? droppedCount / d.length : 0).toFixed(4)),
      loaf: Number(w.__f.loaf.toFixed(2)),
    };
  });
}

async function runSmoothScrollQa() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  });

  const report = {
    viewports: {},
    reducedMotion: {},
    touch: {},
    modalLock: {},
    frameTiming: {},
    pinnedLock: {},
  };

  // 1. Functional tests across viewports
  for (const vp of VIEWPORTS) {
    console.log(`Testing viewport: ${vp.name}...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await settle(page);

    // Test: No horizontal overflow
    const overflowCheck = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .filter((el) => {
          if (getComputedStyle(el).position === 'fixed') return false;
          let p = el.parentElement;
          while (p && p !== document.body) {
            const cs = getComputedStyle(p);
            if (
              cs.overflow === 'hidden' ||
              cs.overflowX === 'hidden' ||
              cs.overflow === 'clip' ||
              cs.contain.includes('paint')
            ) {
              return false;
            }
            p = p.parentElement;
          }
          return el.getBoundingClientRect().right > W + 1;
        })
        .slice(0, 10)
        .map((el) => el.tagName + '.' + el.className);
      return {
        hasNoOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        offenders,
      };
    });

    // Test: Keyboard scrolling
    let keyboardOk = true;
    if (!vp.hasTouch) {
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      const y0 = await page.evaluate(() => scrollY);
      await page.keyboard.press('Space');
      await settle(page);
      const y1 = await page.evaluate(() => scrollY);
      await page.keyboard.press('PageDown');
      await settle(page);
      const y2 = await page.evaluate(() => scrollY);
      await page.keyboard.press('End');
      await settle(page);
      const atBottom = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 4);
      await page.keyboard.press('Home');
      await settle(page);
      const atTop = await page.evaluate(() => scrollY < 4);
      keyboardOk = y1 > y0 && y2 > y1 && atBottom && atTop;
    }

    // Test: In-page anchors land under header with focus moved
    const anchors = page.locator('a[href^="#"]:not([href="#"])');
    const aCount = Math.min(await anchors.count(), 4);
    const anchorResults = [];
    for (let i = 0; i < aCount; i++) {
      const a = anchors.nth(i);
      if (!(await a.isVisible())) continue;
      const href = await a.getAttribute('href');
      await a.click();
      await settle(page);
      const res = await page.evaluate((h) => {
        const el = document.querySelector(h);
        if (!el) return null;
        const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const atBottom = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 4;
        return {
          delta: Math.abs(el.getBoundingClientRect().top - pad),
          atBottom,
          focused: document.activeElement === el,
        };
      }, href);
      if (res) {
        anchorResults.push({
          href,
          delta: Number(res.delta.toFixed(2)),
          atBottom: res.atBottom,
          focused: res.focused,
        });
      }
    }

    report.viewports[vp.name] = {
      overflowCheck,
      keyboardOk,
      anchors: anchorResults,
    };
    await context.close();
  }

  // 2. Reduced Motion
  console.log('Testing reduced motion...');
  {
    const rmContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    await rmPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const smoothData = await rmPage.evaluate(() => document.documentElement.dataset.smoothScroll ?? 'off');
    const hasLenis = await rmPage.evaluate(() => document.documentElement.classList.contains('lenis'));
    const behavior = await rmPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    report.reducedMotion = {
      smoothData,
      hasLenis,
      behavior,
    };
    await rmContext.close();
  }

  // 3. Touch
  console.log('Testing touch mode...');
  {
    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const touchPage = await touchContext.newPage();
    await touchPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const hasLenis = await touchPage.evaluate(() => document.documentElement.classList.contains('lenis'));
    report.touch = { hasLenis };
    await touchContext.close();
  }

  // 4. Modal Lock Without Layout Shift
  console.log('Testing modal lock...');
  {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const modalBtn = page.locator("[data-testid='open-modal']").first();
    await modalBtn.scrollIntoViewIfNeeded();
    await settle(page);

    const before = await page.evaluate(() => ({ y: scrollY, w: document.documentElement.clientWidth }));
    await modalBtn.click();
    await page.waitForTimeout(400);

    // Try scrolling while modal open
    await page.mouse.move(100, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);

    const during = await page.evaluate(() => ({ y: scrollY, w: document.documentElement.clientWidth }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await page.mouse.wheel(0, -400);
    await settle(page);
    const after = await page.evaluate(() => ({ y: scrollY }));

    report.modalLock = {
      beforeY: before.y,
      duringY: during.y,
      didNotMove: Math.abs(before.y - during.y) < 2,
      widthPreserved: before.w === during.w,
      scrollingResumed: after.y < before.y,
    };
    await context.close();
  }

  // 5. Frame Timing (Standard vs 4x CPU Throttling)
  console.log('Testing frame timing...');
  {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await settle(page);

    const standardFrames = await measureFrames(page, () => wheelScroll(page, 90));

    // Throttled 4x
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await settle(page, 8000);

    const throttledFrames = await measureFrames(page, () => wheelScroll(page, 90));

    report.frameTiming = {
      standard: standardFrames,
      throttled4x: throttledFrames,
    };
    await context.close();
  }

  // 6. Pinned Sequence Lock Check
  console.log('Testing pinned sequence lock...');
  {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await settle(page);

    const pin = page.locator('.pin-spacer').first();
    const count = await pin.count();
    if (count > 0) {
      // Scroll into active pinned zone
      await page.evaluate(() => {
        const p = document.querySelector('.pin-spacer');
        if (p) {
          window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY + 120);
        }
      });
      await settle(page);

      const tops = [];
      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, 40);
        await page.waitForTimeout(30);
        const top = await page.evaluate(() => {
          const child = document.querySelector('.pin-spacer > *');
          return child ? child.getBoundingClientRect().top : 0;
        });
        tops.push(top);
      }
      const spread = Number((Math.max(...tops) - Math.min(...tops)).toFixed(2));
      report.pinnedLock = {
        locked: spread < 2,
        spread,
      };
    } else {
      report.pinnedLock = { notPresentAtViewport: true };
    }
    await context.close();
  }

  console.log('Smooth Scroll QA Complete! Report:', JSON.stringify(report, null, 2));
  await browser.close();
}

runSmoothScrollQa().catch((err) => {
  console.error(err);
  process.exit(1);
});
