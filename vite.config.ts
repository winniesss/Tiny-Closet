
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { ViteDevServer } from 'vite';

function imageScrapePlugin() {
  return {
    name: 'image-scrape-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/scrape-image', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const pageUrl = url.searchParams.get('url');

        if (!pageUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        try {
          // Dynamic import for Node built-in fetch (available in Node 18+)
          const response = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Page returned ${response.status}` }));
            return;
          }

          const html = await response.text();

          // Extract og:image
          let imageUrl = '';
          const ogPatterns = [
            /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
            /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
          ];
          for (const pattern of ogPatterns) {
            const m = html.match(pattern);
            if (m?.[1]) { imageUrl = m[1]; break; }
          }

          // Fallback: look for large product images from CDNs
          if (!imageUrl) {
            const cdnPatterns = [
              /https?:\/\/cdn\.shopify\.com\/[^\s"']+\.(?:jpg|png|webp)[^\s"']*/gi,
              /https?:\/\/images[\w.-]*\.(?:amazonaws|cloudfront|imgix)\.com\/[^\s"']+\.(?:jpg|png|webp)[^\s"']*/gi,
              /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"']*)?/gi,
            ];
            for (const pattern of cdnPatterns) {
              const matches = html.match(pattern) || [];
              const good = matches.filter((u: string) =>
                u.length > 50 &&
                !u.includes('logo') && !u.includes('icon') && !u.includes('favicon') &&
                !u.includes('1x1') && !u.includes('pixel') && !u.includes('svg')
              );
              if (good.length > 0) {
                imageUrl = good[0];
                break;
              }
            }
          }

          if (!imageUrl) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No product image found on page' }));
            return;
          }

          // Resolve relative URLs
          if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
          else if (imageUrl.startsWith('/')) {
            const base = new URL(pageUrl);
            imageUrl = base.origin + imageUrl;
          }

          // Fetch the actual image and convert to base64
          const imgResponse = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          });

          if (!imgResponse.ok) {
            // Return the URL at least, browser might be able to load it
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ imageUrl }));
            return;
          }

          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ imageUrl: base64, originalUrl: imageUrl }));

        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Fetch failed' }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  if (!env.API_KEY && mode !== 'production') {
    console.warn("\n\x1b[33m%s\x1b[0m\n", "⚠️  WARNING: API_KEY is missing. Please create a .env file in the root directory with API_KEY=your_key");
  }

  return {
    base: '/',
    plugins: [react(), imageScrapePlugin()],
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});
