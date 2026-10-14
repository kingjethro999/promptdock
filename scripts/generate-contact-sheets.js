const path = require("node:path");
const { chromium } = require("playwright");

const USERNAMES = [
  "alex",
  "sam",
  "jordan",
  "chen",
  "佐藤",
  "ivan",
  "elena",
  "fatima",
  "amara",
  "lucas",
  "kai",
  "tariq",
  "mateo",
  "yuki",
  "zoe",
  "aiden",
  "priya",
  "kwame",
  "leila",
  "max",
  "charlotte",
  "dev_master",
  "builder-99",
  "design_guru",
  "code-ninja",
  "prompt_pro",
  "al",
  "bo",
  "cy",
  "di",
  "verylongusernamethatexceedstwentyfivechars",
  "alpha_beta_gamma",
  "researcher_42",
  "synth-wave",
  "nordic-coder",
  "tokyo-night",
  "sahara_wind",
  "mountain_peak",
  "ocean_breeze",
  "forest_green",
  "ai_architect",
  "prompt_craft",
  "pixel_artist",
  "data_miner",
  "vector_mind",
  "zero_one",
  "bit_stream",
  "quantum_leap",
  "cyber_sage",
  "neo_matrix",
  "apollo",
  "artemis",
  "hermes",
  "athena",
  "zeus",
  "helios",
  "selene",
  "ares",
  "poseidon",
  "hades",
  "curie",
  "turing",
  "lovelace",
  "hopper",
  "newton",
  "galileo",
  "darwin",
  "feynman",
  "hawking",
  "tesla",
  "ruby",
  "rust",
  "python",
  "golang",
  "swift",
  "kotlin",
  "typescript",
  "clojure",
  "elixir",
  "haskell",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
  "uniform",
  "victor",
  "whiskey",
];

async function main() {
  const { Avatar, Style } = await import("@dicebear/core");
  const lorelei = (
    await import("@dicebear/styles/lorelei.json", { with: { type: "json" } })
  ).default;
  const notionists = (
    await import("@dicebear/styles/notionists.json", { with: { type: "json" } })
  ).default;
  const shapes = (
    await import("@dicebear/styles/shapes.json", { with: { type: "json" } })
  ).default;

  const STYLES = [
    { id: "lorelei", style: new Style(lorelei) },
    { id: "notionists", style: new Style(notionists) },
    { id: "shapes", style: new Style(shapes) },
  ];

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1200 },
  });

  const BRAND_COLORS = [
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
  ];

  for (const item of STYLES) {
    const svgs = USERNAMES.map((user, i) => {
      const bg = BRAND_COLORS[i % BRAND_COLORS.length];
      const avatar = new Avatar(item.style, {
        seed: user,
        size: 96,
        backgroundColor: [bg],
      });
      return { user, svg: avatar.toString() };
    });

    for (const theme of ["light", "dark"]) {
      const isDark = theme === "dark";
      const bgColor = isDark ? "#0e1814" : "#f7f8f3";
      const textColor = isDark ? "#f7f8f3" : "#1d2a25";
      const borderColor = isDark ? "#23382e" : "#dbe2dc";

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 32px;
    background: ${bgColor};
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1 {
    font-size: 20px;
    margin-bottom: 24px;
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 16px;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .avatar-box {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid ${borderColor};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-box svg {
    width: 100%;
    height: 100%;
  }
  .name {
    font-size: 10px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.75;
  }
</style>
</head>
<body>
  <h1>Contact Sheet: ${item.id} (${theme} theme) - 100 seeds</h1>
  <div class="grid">
    ${svgs
      .map(
        (s) => `
      <div class="item">
        <div class="avatar-box">${s.svg}</div>
        <div class="name">${s.user}</div>
      </div>
    `,
      )
      .join("")}
  </div>
</body>
</html>`;

      await page.setContent(html);
      const outPath = path.join(
        __dirname,
        `../qa/avatars/contact-${item.id}-${theme}.png`,
      );
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Rendered ${outPath}`);
    }
  }

  await browser.close();
  console.log("Contact sheets successfully generated!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
