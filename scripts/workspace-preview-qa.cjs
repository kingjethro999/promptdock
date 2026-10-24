const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const { webpack } = require("next/dist/compiled/webpack/webpack");

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "promptdock-preview-"));
  const compiler = webpack({
    mode: "development",
    devtool: false,
    entry: path.join(__dirname, "fixtures/workspace-preview.tsx"),
    output: { path: output, filename: "fixture.js" },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: { "@": path.join(root, "src") },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: path.join(__dirname, "helpers/workspace-typescript-loader.cjs"),
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env": JSON.stringify({ NODE_ENV: "development" }),
      }),
    ],
  });
  await new Promise((resolve, reject) =>
    compiler.run((error, stats) => {
      compiler.close(() => {});
      if (error || stats.hasErrors())
        reject(
          error || new Error(stats.toString({ all: false, errors: true })),
        );
      else resolve();
    }),
  );
  const styles = [
    "shared/styles.css",
    "next/ui.css",
    "next/builder.css",
    "next/liquid.css",
  ]
    .map((file) => fs.readFileSync(path.join(root, "src/styles", file), "utf8"))
    .join("\n");
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(fs.readFileSync(path.join(output, "fixture.js")));
    } else if (req.url === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(styles);
    } else if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workspace test</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
      );
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath:
        process.env.BROWSER_EXECUTABLE || "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("Browser error:", error.message);
    });
    await page.route("https://**/*", (route) => route.abort());
    await page.route("**/api/idea-to-prompt", (route) =>
      route.fulfill({
        json: {
          provider: "fixture",
          data: { task: "Write for {{name}}.", raw: true },
        },
      }),
    );
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page
      .getByLabel("Source", { exact: true })
      .fill("Existing source that has not been generated");
    await expect(page.locator("#previewHeading")).toHaveText(
      "Your prompt will appear here",
    );
    await page
      .getByRole("button", { name: "Generate fixture", exact: true })
      .click();
    await expect(page.locator(".prompt-output")).toHaveText(
      "Write for {{name}}.",
    );
    await page.getByLabel("Source", { exact: true }).fill("A changed source");
    await expect(page.locator(".prompt-output")).toHaveText(
      "Write for {{name}}.",
    );
    await page
      .getByRole("button", { name: "Edit prompt", exact: true })
      .click();
    const editor = page.getByRole("textbox", {
      name: "Edit current prompt",
      exact: true,
    });
    await editor.fill("# Edited document\n\nKeep {{name}}.");
    await expect(editor).toBeFocused();
    await page
      .getByRole("button", { name: "Done editing", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "# Edited document\n\nKeep {{name}}.",
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download/ }).click();
    const download = await downloadEvent;
    assert.equal(
      fs.readFileSync(await download.path(), "utf8"),
      "# Edited document\n\nKeep {{name}}.",
    );
    let savedBody;
    await page.route("**/api/prompts", (route) => {
      savedBody = route.request().postDataJSON();
      return route.fulfill({
        json: { prompt: { ...savedBody, updatedAt: "2026-10-24T00:00:00Z" } },
      });
    });
    await page.route("**/api/collections**", (route) =>
      route.fulfill({ json: { collections: [] } }),
    );
    await page
      .getByRole("button", { name: "Save prompt to library", exact: true })
      .click();
    await expect
      .poll(() => savedBody?.data?.task)
      .toBe("# Edited document\n\nKeep {{name}}.");
    assert.equal(savedBody.idea, "Existing source that has not been generated");
    await page.keyboard.press("Escape");
    // A delayed Run from this document must never appear after another is loaded.
    let delayed;
    await page.route("**/api/run", (route) => {
      delayed = route;
    });
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect.poll(() => Boolean(delayed)).toBe(true);
    await page
      .getByRole("button", { name: "Load saved fixture", exact: true })
      .click();
    await delayed.fulfill({ json: { text: "STALE RESULT", provider: "old" } });
    await expect(page.getByText("STALE RESULT", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Run", exact: true }),
    ).toBeEnabled();
    delayed = null;
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect.poll(() => Boolean(delayed)).toBe(true);
    await page.getByLabel("{{name}}", { exact: true }).fill("Changed variable");
    await delayed.fulfill({
      json: {
        results: [{ text: "STALE COMPARISON", provider: "old", success: true }],
      },
    });
    await expect(
      page.getByText("STALE COMPARISON", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Compare", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Load saved fixture", exact: true })
      .click();
    await expect(page.getByLabel("{{name}}", { exact: true })).toHaveValue("");
    for (const width of [320, 360, 390, 412, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Overflow at ${width}px`,
      );
    }
    await page.unroute("**/api/idea-to-prompt");
    await page.route("**/api/idea-to-prompt", (route) =>
      route.fulfill({
        json: {
          provider: "source-preserved",
          data: { task: "Preserved source", raw: true },
        },
      }),
    );
    await page
      .getByRole("button", { name: "Clear fixture", exact: true })
      .click();
    await page.getByLabel("Source", { exact: true }).fill("Preserved source");
    await page
      .getByRole("button", { name: "Generate fixture", exact: true })
      .click();
    await expect(page.locator("#previewHeading")).toHaveText(
      "Your preserved source",
    );
    await expect(page.locator(".preview-subtitle")).toContainText(
      "not AI-refined",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real preview/store browser checks: source preservation, edit/focus, copy/download/save agreement, stale Run/Compare, temporary variable reset, fallback labeling, widths 320/360/390/412/768/1280, no page errors.",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    // Only remove the exact mkdtemp output owned by this invocation.
    fs.rmSync(output, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
