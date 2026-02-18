import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE_ORIGIN = 'https://gameye.com';

const PRICING_SOURCE = path.join(ROOT, 'src', 'pages', 'pricing', 'index.astro');
const CHATBOT_SCRIPT = path.join(ROOT, 'public', 'chatbot', 'chatbot-loader.js');

const REQUIRED_SITEMAP_URLS = ['https://gameye.com/', 'https://gameye.com/pricing/', 'https://gameye.com/docs/'];

const EXCLUDED_SITEMAP_URLS = [
  'https://gameye.com/docs/api/',
  'https://gameye.com/docs/quickstart/',
  'https://gameye.com/docs/integrations/',
  'https://gameye.com/docs/operations/',
];

const BRIDGE_ROUTE_TARGETS = {
  '/docs/api/': 'https://docs.gameye.com/api/reference',
  '/docs/quickstart/': 'https://docs.gameye.com/getting-started/quickstart',
  '/docs/integrations/': 'https://docs.gameye.com/guides/integrations',
  '/docs/operations/': 'https://docs.gameye.com/troubleshooting',
};

const REQUIRED_PRICING_EVENTS = [
  'pricing_estimator_updated',
  'pricing_scenario_selected',
  'pricing_cta_clicked',
];

const REQUIRED_CHATBOT_EVENTS = [
  'gy_chatbot_opened',
  'gy_chatbot_question_submitted',
  'gy_chatbot_response_received',
  'gy_chatbot_citation_clicked',
  'gy_chatbot_fallback_routed',
  'gy_chatbot_fallback_link_clicked',
  'gy_chatbot_error',
];

function normalizePathname(value) {
  if (!value) return '/';
  const trimmed = value.endsWith('/') && value !== '/' ? value.slice(0, -1) : value;
  return trimmed || '/';
}

function isLegacyWpAsset(pathname) {
  return pathname.startsWith('/wp-content/') || pathname.startsWith('/wp-includes/');
}

function isSkippableLink(raw) {
  if (!raw) return true;
  const value = raw.trim();
  if (!value) return true;
  return (
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('javascript:') ||
    value.startsWith('data:')
  );
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function toWebPath(filePath) {
  return `/${path.relative(DIST, filePath).split(path.sep).join('/')}`;
}

function htmlFileToRoute(filePath) {
  const rel = path.relative(DIST, filePath).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  if (rel.endsWith('.html')) return `/${rel.slice(0, -'.html'.length)}`;
  return null;
}

function routeToHtmlFile(route) {
  const normalized = route === '/' ? '/index.html' : `${route.replace(/\/$/, '')}/index.html`;
  return path.join(DIST, normalized.replace(/^\//, ''));
}

function resolveInternalPath(raw, currentRoute) {
  const base = new URL(currentRoute.endsWith('/') ? currentRoute : `${currentRoute}/`, SITE_ORIGIN);
  const resolved = new URL(raw, base);
  if (resolved.origin !== SITE_ORIGIN) return null;
  return `${resolved.pathname}${resolved.search}`;
}

function extractReferences(html) {
  return [...html.matchAll(/(?:href|src)=\"([^\"]+)\"/g)].map((m) => m[1]);
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

async function loadSitemapUrlsFromIndex() {
  const indexXml = await readText(path.join(DIST, 'sitemap-index.xml'));
  const sitemapLocs = extractLocs(indexXml);

  if (sitemapLocs.length === 0) {
    throw new Error('No sitemap files referenced in dist/sitemap-index.xml');
  }

  const urls = new Set();

  for (const loc of sitemapLocs) {
    const fileName = path.basename(new URL(loc).pathname);
    const sitemapPath = path.join(DIST, fileName);
    const sitemapXml = await readText(sitemapPath);
    for (const url of extractLocs(sitemapXml)) urls.add(url);
  }

  return urls;
}

async function main() {
  const failures = [];

  const files = await walk(DIST);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));

  if (htmlFiles.length === 0) {
    throw new Error('No HTML files found in dist. Run npm run build first.');
  }

  const assetPaths = new Set(files.map(toWebPath));
  const routePaths = new Set();

  for (const htmlFile of htmlFiles) {
    const route = htmlFileToRoute(htmlFile);
    if (!route) continue;
    routePaths.add(normalizePathname(route));
  }

  for (const htmlFile of htmlFiles) {
    const route = htmlFileToRoute(htmlFile);
    if (!route) continue;

    const html = await readFile(htmlFile, 'utf8');
    const refs = extractReferences(html);

    for (const ref of refs) {
      if (isSkippableLink(ref)) continue;
      const resolved = resolveInternalPath(ref, route);
      if (!resolved) continue;

      const [pathname] = resolved.split('?');
      if (!pathname) continue;

      const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
      if (hasExtension && !pathname.endsWith('.html')) {
        if (isLegacyWpAsset(pathname)) {
          continue;
        }
        if (!assetPaths.has(pathname)) {
          failures.push(`broken asset reference on ${route}: ${ref}`);
        }
        continue;
      }

      const normalized = normalizePathname(pathname);
      if (!routePaths.has(normalized)) {
        failures.push(`broken internal link on ${route}: ${ref}`);
      }
    }
  }

  const sitemapUrls = await loadSitemapUrlsFromIndex();
  const normalizedSitemapUrls = new Set([...sitemapUrls].map((url) => normalizePathname(new URL(url).pathname)));

  for (const url of REQUIRED_SITEMAP_URLS) {
    const pathname = normalizePathname(new URL(url).pathname);
    if (!normalizedSitemapUrls.has(pathname)) {
      failures.push(`sitemap missing required URL: ${url}`);
    }
  }

  for (const url of EXCLUDED_SITEMAP_URLS) {
    const pathname = normalizePathname(new URL(url).pathname);
    if (normalizedSitemapUrls.has(pathname)) {
      failures.push(`sitemap should exclude bridge URL (noindex): ${url}`);
    }
  }

  for (const [route, target] of Object.entries(BRIDGE_ROUTE_TARGETS)) {
    const htmlPath = routeToHtmlFile(route);
    const html = await readText(htmlPath);

    if (!/meta[^>]+name=\"robots\"[^>]+noindex/i.test(html)) {
      failures.push(`bridge route missing noindex robots meta: ${route}`);
    }

    if (!html.includes(target)) {
      failures.push(`bridge route missing canonical docs target link: ${route} -> ${target}`);
    }
  }

  const pricingSource = await readText(PRICING_SOURCE);
  if (!pricingSource.includes('window.dataLayer')) {
    failures.push('pricing estimator analytics missing window.dataLayer integration');
  }

  for (const eventName of REQUIRED_PRICING_EVENTS) {
    if (!pricingSource.includes(eventName)) {
      failures.push(`pricing analytics event missing: ${eventName}`);
    }
  }

  const chatbotSource = await readText(CHATBOT_SCRIPT);
  if (!chatbotSource.includes('window.dataLayer')) {
    failures.push('chatbot analytics missing window.dataLayer integration');
  }

  for (const eventName of REQUIRED_CHATBOT_EVENTS) {
    if (!chatbotSource.includes(eventName)) {
      failures.push(`chatbot analytics event missing: ${eventName}`);
    }
  }

  if (failures.length > 0) {
    console.error('Launch readiness checks failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Launch readiness checks passed for ${htmlFiles.length} HTML files, ${Object.keys(BRIDGE_ROUTE_TARGETS).length} bridge routes, and ${REQUIRED_PRICING_EVENTS.length + REQUIRED_CHATBOT_EVENTS.length} analytics events.`
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
