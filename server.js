import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Stealth mode — makes headless Chrome undetectable
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return CHROME_PATHS[0];
}

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || findChrome();
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900',
    ],
  });
  return browser;
}

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/api/scrape-image', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl) return res.json({ error: 'Missing url parameter' });

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setViewport({ width: 1280, height: 900 });

    // Block heavy resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['font', 'media', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate with networkidle2 for JS-heavy sites
    await page.goto(pageUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Extra wait for lazy-loaded images
    await new Promise(r => setTimeout(r, 1500));

    // Extract image URL — 5 strategies
    const imageUrl = await page.evaluate(() => {
      // 1. og:image
      const og = document.querySelector('meta[property="og:image"]');
      if (og?.getAttribute('content')?.startsWith('http')) return og.getAttribute('content');

      // 2. Twitter card
      const tw = document.querySelector('meta[name="twitter:image"]');
      if (tw?.getAttribute('content')?.startsWith('http')) return tw.getAttribute('content');

      // 3. JSON-LD structured data (most e-commerce sites)
      for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const walk = (obj) => {
            if (!obj) return null;
            if (Array.isArray(obj)) {
              for (const item of obj) { const r = walk(item); if (r) return r; }
              return null;
            }
            if (obj.image) {
              const img = Array.isArray(obj.image) ? obj.image[0] : obj.image;
              if (typeof img === 'string' && img.startsWith('http')) return img;
              if (img?.url?.startsWith('http')) return img.url;
              if (img?.contentUrl?.startsWith('http')) return img.contentUrl;
            }
            // Check @graph
            if (obj['@graph']) return walk(obj['@graph']);
            return null;
          };
          const data = JSON.parse(el.textContent || '');
          const found = walk(data);
          if (found) return found;
        } catch {}
      }

      // 4. data-srcset / srcset (lazy loaded images)
      for (const img of document.querySelectorAll('img[data-src], img[srcset], img[data-srcset]')) {
        const src = img.getAttribute('data-src') || '';
        const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';

        // Get highest resolution from srcset
        if (srcset) {
          const parts = srcset.split(',').map(s => s.trim().split(/\s+/));
          const urls = parts.filter(p => p[0]?.startsWith('http')).sort((a, b) => {
            const wa = parseInt(a[1]) || 0;
            const wb = parseInt(b[1]) || 0;
            return wb - wa;
          });
          if (urls.length > 0) {
            const url = urls[0][0];
            if (!url.includes('logo') && !url.includes('icon') && url.length > 40) return url;
          }
        }

        if (src?.startsWith('http') && src.length > 40 && !src.includes('logo') && !src.includes('icon')) {
          return src;
        }
      }

      // 5. First large visible image
      for (const img of document.querySelectorAll('img')) {
        const src = img.src || img.getAttribute('data-src') || '';
        if (!src.startsWith('http') || src.length < 30) continue;
        if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) continue;
        if (src.includes('pixel') || src.includes('1x1') || src.includes('spacer') || src.includes('.svg')) continue;

        const rect = img.getBoundingClientRect();
        const w = img.naturalWidth || rect.width;
        const h = img.naturalHeight || rect.height;

        if (w > 150 && h > 150) return src;
      }

      return null;
    });

    if (!imageUrl) {
      return res.json({ error: 'No product image found on this page' });
    }

    // Resolve protocol-relative URLs
    let fullUrl = imageUrl;
    if (fullUrl.startsWith('//')) fullUrl = 'https:' + fullUrl;

    // Fetch image as base64 via a new page (handles cookies/referrer)
    const imgPage = await b.newPage();
    try {
      const imgResponse = await imgPage.goto(fullUrl, { timeout: 10000, waitUntil: 'load' });
      if (imgResponse?.ok()) {
        const buffer = await imgResponse.buffer();
        const contentType = imgResponse.headers()['content-type'] || 'image/jpeg';
        const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        return res.json({ imageUrl: base64, originalUrl: fullUrl });
      }
    } finally {
      await imgPage.close();
    }

    return res.json({ imageUrl: fullUrl, originalUrl: fullUrl });

  } catch (err) {
    console.error('Scrape error:', err.message);
    return res.json({ error: err.message || 'Failed to scrape page' });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Instagram grid scraper ──────────────────────────────────────────
app.get('/api/scrape-instagram', async (req, res) => {
  const handle = req.query.handle;
  const limit = Math.min(parseInt(req.query.limit) || 9, 30);

  if (!handle) {
    return res.json({ error: 'Missing handle parameter' });
  }

  let igBrowser = null;
  let page = null;

  try {
    // Launch a dedicated browser with mobile viewport for Instagram
    igBrowser = await puppeteer.launch({
      headless: 'new',
      executablePath: findChrome(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=375,812',
      ],
    });

    page = await igBrowser.newPage();

    // Mobile user agent + viewport
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    await page.setViewport({ width: 375, height: 812, isMobile: true });

    // Block fonts / media to speed things up
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const type = r.resourceType();
      if (['font', 'media', 'websocket'].includes(type)) {
        r.abort();
      } else {
        r.continue();
      }
    });

    // Navigate to the profile
    await page.goto(`https://www.instagram.com/${handle}/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for post grid images to appear
    await page.waitForSelector('article img, a[href*="/p/"] img', {
      timeout: 15000,
    }).catch(() => {});

    // Extra settle time for lazy images
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll down once to trigger more lazy loads
    await page.evaluate(() => window.scrollBy(0, 600));
    await new Promise((r) => setTimeout(r, 1500));

    // Extract post data from the grid
    const rawPosts = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Strategy 1: links to /p/ or /reel/ containing images
      const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      for (const link of postLinks) {
        const img = link.querySelector('img');
        if (!img) continue;
        const src = img.src || img.getAttribute('data-src') || '';
        const href = link.getAttribute('href') || '';
        if (src && !seen.has(href)) {
          seen.add(href);
          results.push({ imageUrl: src, postUrl: href });
        }
      }

      // Strategy 2: article img elements (fallback)
      if (results.length === 0) {
        const articleImgs = document.querySelectorAll('article img');
        for (const img of articleImgs) {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!src || src.includes('profile') || src.includes('avatar')) continue;
          // Try to find the closest link ancestor
          const parentLink = img.closest('a[href*="/p/"], a[href*="/reel/"]');
          const href = parentLink?.getAttribute('href') || '';
          const key = href || src;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ imageUrl: src, postUrl: href });
          }
        }
      }

      return results;
    });

    // Trim to requested limit
    const postsToFetch = rawPosts.slice(0, limit);

    if (postsToFetch.length === 0) {
      return res.json({
        error: 'No posts found. The profile may be private or the page structure changed.',
        posts: [],
      });
    }

    // Convert each image to base64 (CDN URLs expire quickly)
    const posts = [];
    for (const post of postsToFetch) {
      try {
        const imgPage = await igBrowser.newPage();
        try {
          const imgResponse = await imgPage.goto(post.imageUrl, {
            timeout: 10000,
            waitUntil: 'load',
          });
          if (imgResponse?.ok()) {
            const buffer = await imgResponse.buffer();
            const contentType = imgResponse.headers()['content-type'] || 'image/jpeg';
            posts.push({
              imageUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
              postUrl: post.postUrl,
            });
          } else {
            posts.push({ imageUrl: post.imageUrl, postUrl: post.postUrl });
          }
        } finally {
          await imgPage.close();
        }
      } catch {
        // If single image fails, include original URL as fallback
        posts.push({ imageUrl: post.imageUrl, postUrl: post.postUrl });
      }

      // 1-2 second delay between fetches to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    }

    return res.json({ posts });
  } catch (err) {
    console.error('Instagram scrape error:', err.message);
    return res.json({ error: err.message || 'Failed to scrape Instagram', posts: [] });
  } finally {
    if (igBrowser) await igBrowser.close().catch(() => {});
  }
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

// Serve frontend static files
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🖼️  Tiny Closet running at http://localhost:${PORT}`);
});
