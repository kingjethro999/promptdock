const fs = require('fs');
const path = require('path');
const { request: pwRequest } = require('playwright');

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_QA_DIR = '/home/king/.gemini/antigravity-ide/brain/3f458dbb-c4f5-4ffa-b718-41bdb401e18d/qa/og';
const LOCAL_QA_DIR = path.join(__dirname, '..', 'qa', 'og');

[ARTIFACT_QA_DIR, LOCAL_QA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const CRAWLER_UAS = [
  'facebookexternalhit/1.1',
  'Twitterbot/1.0',
  'WhatsApp/2.23',
  'LinkedInBot/1.0',
  'Slackbot-LinkExpanding 1.0',
  'Discordbot/2.0',
];

const PAGES_TO_TEST = [
  { path: '/', label: 'root', isPublic: true },
  { path: '/p/bceab6e7-c234-4528-8d8f-2f40f70e114f', label: 'shared prompt', isPublic: true },
  { path: '/invite/_cuzEtopXMrI', label: 'invite', isPublic: true },
];

async function run() {
  console.log('=== SOCIAL PREVIEWS QA & VERIFICATION ===\n');

  const request = await pwRequest.newContext();

  const results = {
    crawlers: [],
    images: [],
    fallbacks: [],
  };

  // 1. Crawler Raw HTML Verification
  console.log('--- 1. Testing Crawler User Agents (Server-Rendered HTML Tags) ---');
  for (const pageInfo of PAGES_TO_TEST) {
    for (const ua of CRAWLER_UAS) {
      const res = await request.get(`${BASE_URL}${pageInfo.path}`, {
        headers: { 'User-Agent': ua },
      });
      const html = await res.text();

      const tag = (k) => {
        const match = new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`, 'i').exec(html);
        return match ? match[1] : null;
      };

      const ogTitle = tag('og:title');
      const ogDesc = tag('og:description');
      const ogImg = tag('og:image');
      const twCard = tag('twitter:card');
      const twImg = tag('twitter:image');

      const pass = Boolean(ogTitle && ogDesc && ogImg && twCard === 'summary_large_image' && twImg === ogImg);
      if (!pass) {
        console.error(`FAIL: ${pageInfo.label} with UA "${ua}" missing or mismatched tags.`);
        process.exit(1);
      }
    }
    console.log(`✓ ${pageInfo.label} (${pageInfo.path}): all crawler UAs received full OG and Twitter tags.`);
  }

  // 2. Image Route Verification (Dimensions, Size, Timing, Headers)
  console.log('\n--- 2. Testing Image Generation & Spec Compliance ---');
  const IMAGE_ROUTES = [
    { url: '/api/og/default', name: 'default-brand.png', label: 'Brand Card' },
    { url: '/api/og/p/bceab6e7-c234-4528-8d8f-2f40f70e114f', name: 'shared-prompt-mines.png', label: 'Shared Prompt Card' },
    { url: '/api/og/invite/_cuzEtopXMrI', name: 'invite-kingjethro.png', label: 'Invite Card' },
    { url: '/api/og/invite/does-not-exist', name: 'fallback-unknown-invite.png', label: 'Fallback Invite Card' },
    { url: '/api/og/p/00000000-0000-0000-0000-000000000000', name: 'fallback-unknown-prompt.png', label: 'Fallback Prompt Card' },
  ];

  for (const imgItem of IMAGE_ROUTES) {
    const t0 = Date.now();
    const res = await request.get(`${BASE_URL}${imgItem.url}`);
    const ms = Date.now() - t0;

    if (res.status() !== 200) {
      console.error(`FAIL: ${imgItem.url} returned status ${res.status()}`);
      process.exit(1);
    }

    const contentType = res.headers()['content-type'] || '';
    const cacheControl = res.headers()['cache-control'] || '';
    if (!contentType.includes('image/png')) {
      console.error(`FAIL: ${imgItem.url} returned non-png content-type: ${contentType}`);
      process.exit(1);
    }

    const buf = await res.body();
    // Verify PNG header and IHDR dimensions at byte 16 and 20
    const isPng = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const sizeKb = (buf.length / 1024).toFixed(1);

    if (!isPng || width !== 1200 || height !== 630) {
      console.error(`FAIL: ${imgItem.url} dimensions are ${width}x${height}, expected 1200x630 PNG`);
      process.exit(1);
    }

    if (buf.length > 600000) {
      console.error(`FAIL: ${imgItem.url} size ${sizeKb} KB exceeds hard maximum 600 KB`);
      process.exit(1);
    }

    // Save PNG to disk for visual review
    fs.writeFileSync(path.join(ARTIFACT_QA_DIR, imgItem.name), buf);
    fs.writeFileSync(path.join(LOCAL_QA_DIR, imgItem.name), buf);

    console.log(`✓ ${imgItem.label}: ${width}x${height} PNG | ${sizeKb} KB | ${ms} ms | Cache: ${cacheControl.slice(0, 35)}...`);

    results.images.push({
      label: imgItem.label,
      url: imgItem.url,
      width,
      height,
      sizeKb,
      ms,
      cacheControl,
    });
  }

  // 3. Fallback and Privacy Guards
  console.log('\n--- 3. Testing Fallbacks & Privacy (Pages 404, Images 200 Generic) ---');
  const unknownInvitePage = await request.get(`${BASE_URL}/invite/non-existent-code`);
  if (unknownInvitePage.status() !== 404) {
    console.error(`FAIL: /invite/non-existent-code returned ${unknownInvitePage.status()}, expected 404`);
    process.exit(1);
  }
  console.log(`✓ Unknown invite page returns real 404.`);

  const unknownPromptPage = await request.get(`${BASE_URL}/p/non-existent-id`);
  if (unknownPromptPage.status() !== 404) {
    console.error(`FAIL: /p/non-existent-id returned ${unknownPromptPage.status()}, expected 404`);
    process.exit(1);
  }
  console.log(`✓ Unknown prompt page returns real 404.`);

  const unknownPromptImage = await request.get(`${BASE_URL}/api/og/p/non-existent-id`);
  if (unknownPromptImage.status() !== 200) {
    console.error(`FAIL: /api/og/p/non-existent-id returned ${unknownPromptImage.status()}, expected 200 generic card`);
    process.exit(1);
  }
  if (!unknownPromptImage.headers()['cache-control'].includes('s-maxage=300')) {
    console.error(`FAIL: /api/og/p/non-existent-id cache control should be short (s-maxage=300)`);
    process.exit(1);
  }
  console.log(`✓ Unknown prompt image returns 200 generic card with short cache.`);

  await request.dispose();
  console.log('\n=== ALL SOCIAL PREVIEW QA CHECKS PASSED ===');
}

run().catch((err) => {
  console.error('QA script error:', err);
  process.exit(1);
});
