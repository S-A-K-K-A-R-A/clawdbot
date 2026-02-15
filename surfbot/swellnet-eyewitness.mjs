import puppeteer from 'puppeteer-core';

const LOGIN_URL = 'https://www.swellnet.com/user/login?destination=/';
const REPORT_URL = 'https://www.swellnet.com/reports/australia/western-australia/margaret-river';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function extractEyewitnessText(page) {
  // Heuristic: find a section containing the word "Eyewitness" and pull nearby text.
  return await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const candidates = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const tag = el.tagName?.toLowerCase();
      if (!tag) continue;
      if (!['h1', 'h2', 'h3', 'h4', 'strong', 'b', 'div', 'section', 'article', 'p'].includes(tag)) continue;
      const t = norm(el.textContent);
      if (t.toLowerCase().includes('eyewitness')) candidates.push(el);
    }

    const uniq = Array.from(new Set(candidates));
    for (const el of uniq) {
      const isHeading = /^h[1-4]$/.test(el.tagName.toLowerCase());
      const container = isHeading ? el.closest('section, article, div') : el.closest('article, section') || el;
      if (!container) continue;
      const text = norm(container.innerText);
      if (text.length > 80 && text.length < 7000) return text;
    }

    const paras = Array.from(document.querySelectorAll('p'))
      .map((p) => norm(p.innerText))
      .filter((t) => t.length > 80);
    return paras[0] || '';
  });
}

async function connectBrowser({ token, preferredRegion }) {
  const regionsToTry = Array.from(new Set([preferredRegion, 'sfo'])).filter(Boolean);
  let lastErr = null;

  for (const r of regionsToTry) {
    const wsBase = `wss://production-${r}.browserless.io`;
    const ws = `${wsBase}/stealth?token=${encodeURIComponent(token)}`;
    try {
      return await puppeteer.connect({ browserWSEndpoint: ws });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Unable to connect to Browserless');
}

async function run() {
  const token = requireEnv('BROWSERLESS_TOKEN');
  const region = process.env.BROWSERLESS_REGION || 'syd';
  const username = requireEnv('SWELLNET_USERNAME');
  const password = requireEnv('SWELLNET_PASSWORD');

  const browser = await connectBrowser({ token, preferredRegion: region });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });

    // Login
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });

    const filledUser = await page.evaluate((username) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const pick = (pred) => inputs.find(pred);
      const u =
        pick((i) => /mail|email|name|user/i.test(i.name || '') || i.type === 'email') ||
        inputs.find((i) => i.type === 'text');
      if (!u) return false;
      u.focus();
      u.value = '';
      u.dispatchEvent(new Event('input', { bubbles: true }));
      u.value = username;
      u.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, username);

    if (!filledUser) throw new Error('Could not locate username field');

    const filledPass = await page.evaluate((password) => {
      const p = document.querySelector('input[type="password"]');
      if (!p) return false;
      p.focus();
      p.value = '';
      p.dispatchEvent(new Event('input', { bubbles: true }));
      p.value = password;
      p.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, password);

    if (!filledPass) throw new Error('Could not locate password field');

    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
      page.click('button[type="submit"], input[type="submit"], button').catch(() => null),
    ]);

    // Report page
    await page.goto(REPORT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const eyewitness = await extractEyewitnessText(page);

    if (!eyewitness || eyewitness.length < 60) {
      throw new Error('Eyewitness report text not found (or too short)');
    }

    process.stdout.write(JSON.stringify({ ok: true, source: 'swellnet', eyewitness }));
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  process.stdout.write(JSON.stringify({ ok: false, source: 'swellnet', error: String(err?.message || err) }));
  process.exitCode = 0;
});
