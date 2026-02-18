import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const LLM_PATH = path.join(ROOT, 'public', 'llms.txt');
const SITEMAP_INDEX_PATH = path.join(ROOT, 'dist', 'sitemap-index.xml');
const DOCS_INDEX_SOURCE_PATH = path.join(ROOT, 'src', 'pages', 'docs', 'index.astro');

const REQUIRED_LLMS_URLS = [
  'https://gameye.com/sitemap-index.xml',
  'https://gameye.com/docs/',
  'https://docs.gameye.com/',
  'https://docs.gameye.com/api/reference',
  'https://docs.gameye.com/guides/integrations',
  'https://docs.gameye.com/troubleshooting',
  'https://gameye.com/contact-us/',
];

const REQUIRED_DOCS_INDEX_TARGETS = [
  'https://docs.gameye.com/getting-started/quickstart',
  'https://docs.gameye.com/api/reference',
  'https://docs.gameye.com/guides/integrations',
  'https://docs.gameye.com/troubleshooting',
];

const REQUIRED_SITEMAP_URLS = ['https://gameye.com/', 'https://gameye.com/docs/'];

const EXCLUDED_DOCS_BRIDGE_URLS = [
  'https://gameye.com/docs/api/',
  'https://gameye.com/docs/quickstart/',
  'https://gameye.com/docs/integrations/',
  'https://gameye.com/docs/operations/',
];

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function normalizeUrl(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

async function loadSitemapUrlsFromIndex() {
  const indexXml = await readText(SITEMAP_INDEX_PATH);
  const sitemapLocs = extractLocs(indexXml);

  if (sitemapLocs.length === 0) {
    throw new Error('No sitemap files referenced in dist/sitemap-index.xml');
  }

  const urls = new Set();

  for (const loc of sitemapLocs) {
    const fileName = path.basename(new URL(loc).pathname);
    const sitemapPath = path.join(ROOT, 'dist', fileName);
    const sitemapXml = await readText(sitemapPath);
    for (const url of extractLocs(sitemapXml)) urls.add(url);
  }

  return urls;
}

async function main() {
  const failures = [];

  const llms = await readText(LLM_PATH);
  for (const url of REQUIRED_LLMS_URLS) {
    if (!llms.includes(url)) failures.push(`llms.txt missing required URL: ${url}`);
  }

  const docsIndexSource = await readText(DOCS_INDEX_SOURCE_PATH);
  for (const url of REQUIRED_DOCS_INDEX_TARGETS) {
    if (!docsIndexSource.includes(url)) {
      failures.push(`docs index bridge is missing canonical docs target: ${url}`);
    }
    if (!llms.includes(url)) {
      failures.push(`llms.txt missing docs index canonical target: ${url}`);
    }
  }

  const sitemapUrls = await loadSitemapUrlsFromIndex();
  const normalizedSitemapUrls = new Set([...sitemapUrls].map(normalizeUrl));

  for (const url of REQUIRED_SITEMAP_URLS) {
    if (!normalizedSitemapUrls.has(normalizeUrl(url))) failures.push(`sitemap missing required URL: ${url}`);
  }

  for (const url of EXCLUDED_DOCS_BRIDGE_URLS) {
    if (normalizedSitemapUrls.has(normalizeUrl(url))) {
      failures.push(`sitemap should exclude bridge URL (noindex): ${url}`);
    }
  }

  if (failures.length > 0) {
    console.error('Parity checks failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Parity checks passed for ${sitemapUrls.size} sitemap URLs with ${REQUIRED_LLMS_URLS.length} llms anchors.`
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
