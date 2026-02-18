import path from 'node:path';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_CLOUDFLARE_REDIRECTS_PATH, parseCloudflareRedirects } from './lib/cloudflare-redirects.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const DEFAULT_TOP25_CSV_PATH = path.join(ROOT, 'redirects', 'gameye-top-25-must-migrate-2026-02-18.csv');
const DEFAULT_REPORT_PATH = path.join(ROOT, 'reports', 'parity', 'top25-parity-report.md');

function getArg(flag, fallbackValue) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return fallbackValue;
  return process.argv[index + 1];
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') continue;
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.some(Boolean)).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = r[i] ?? '';
    }
    return obj;
  });
}

function normalizePathname(value) {
  if (!value) return '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  const trimmed = withLeading.endsWith('/') && withLeading !== '/' ? withLeading.slice(0, -1) : withLeading;
  return trimmed || '/';
}

function pathFromUrlOrPath(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '/';
  if (/^https?:\/\//i.test(raw)) {
    return normalizePathname(new URL(raw).pathname);
  }
  return normalizePathname(raw);
}

function comparableTarget(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.hostname === 'gameye.com' || url.hostname === 'www.gameye.com') {
      return `${normalizePathname(url.pathname)}${url.search || ''}`;
    }
    return `${url.origin}${normalizePathname(url.pathname)}${url.search || ''}`;
  }
  return normalizePathname(raw);
}

function comparableObservedTarget(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.hostname === 'gameye.com' || url.hostname === 'www.gameye.com') {
      return `${normalizePathname(url.pathname)}${url.search || ''}`;
    }
    return `${url.origin}${normalizePathname(url.pathname)}${url.search || ''}`;
  }
  return normalizePathname(raw);
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

function htmlFileToRoute(filePath) {
  const rel = path.relative(DIST, filePath).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  if (rel.endsWith('.html')) return `/${rel.slice(0, -'.html'.length)}`;
  return null;
}

function toMarkdownTable(rows) {
  const header = '| Rank | Source | Handling | Destination | Result | Notes |';
  const rule = '|---:|---|---|---|---|---|';
  const body = rows.map((row) => {
    return `| ${row.rank} | \`${row.source}\` | ${row.handling} | \`${row.destination}\` | ${row.result} | ${row.notes} |`;
  });
  return [header, rule, ...body].join('\n');
}

async function main() {
  const top25CsvPath = path.resolve(getArg('--input', DEFAULT_TOP25_CSV_PATH));
  const redirectsPath = path.resolve(getArg('--redirects', DEFAULT_CLOUDFLARE_REDIRECTS_PATH));
  const reportPath = path.resolve(getArg('--report', DEFAULT_REPORT_PATH));

  const [top25Csv, redirectsSource, distFiles] = await Promise.all([
    readFile(top25CsvPath, 'utf8'),
    readFile(redirectsPath, 'utf8'),
    walk(DIST),
  ]);

  const topRows = parseCsv(top25Csv).sort((a, b) => Number(a.rank) - Number(b.rank));
  if (topRows.length !== 25) {
    throw new Error(`Expected 25 top-priority rows in ${path.relative(ROOT, top25CsvPath)}, found ${topRows.length}`);
  }

  const routeSet = new Set();
  for (const file of distFiles.filter((item) => item.endsWith('.html'))) {
    const route = htmlFileToRoute(file);
    if (route) routeSet.add(normalizePathname(route));
  }

  const parsedRedirects = parseCloudflareRedirects(redirectsSource);
  const failures = [...parsedRedirects.failures];
  const redirectBySource = new Map(parsedRedirects.entries.map((entry) => [normalizePathname(entry.source), entry]));

  const reportRows = [];
  for (const row of topRows) {
    const rank = Number(row.rank);
    const source = pathFromUrlOrPath(row.pathname || row.url);
    const expectedDestination = comparableTarget(row.recommended_destination);
    const isMigrated = routeSet.has(source);
    const redirectEntry = redirectBySource.get(source);

    let handling = 'unhandled';
    let destination = '';
    let result = 'FAIL';
    let notes = '';

    if (isMigrated && redirectEntry) {
      failures.push(`top-25 rank ${rank} (${source}) is both a built route and a redirect source.`);
      handling = 'conflict';
      destination = redirectEntry.target;
      notes = 'Source appears in both built routes and _redirects.';
    } else if (isMigrated) {
      handling = 'migrated';
      destination = source;
      result = 'PASS';
      notes = 'Source path is implemented as a first-class route.';
    } else if (redirectEntry) {
      handling = 'redirected';
      destination = redirectEntry.target;
      const statusOk = redirectEntry.status === 301;
      const destinationOk = comparableObservedTarget(redirectEntry.target) === expectedDestination;

      if (!statusOk) {
        failures.push(`top-25 rank ${rank} (${source}) has non-301 status (${redirectEntry.status}).`);
      }
      if (!destinationOk) {
        failures.push(
          `top-25 rank ${rank} (${source}) target mismatch: expected ${expectedDestination}, got ${redirectEntry.target}.`
        );
      }

      if (statusOk && destinationOk) {
        result = 'PASS';
        notes = 'Redirect source exists in _redirects with expected target.';
      } else {
        notes = 'Redirect exists but status/target does not match expected mapping.';
      }
    } else {
      failures.push(`top-25 rank ${rank} (${source}) is neither migrated nor redirected.`);
      handling = 'missing';
      destination = '(none)';
      notes = 'No route and no redirect mapping found.';
    }

    reportRows.push({
      rank,
      source,
      handling,
      destination,
      result,
      notes,
    });
  }

  // Acceptance criterion: legal routes must be explicitly handled.
  for (const legalPath of ['/privacy-policy', '/terms-and-conditions']) {
    const normalizedLegal = normalizePathname(legalPath);
    const legalReport = reportRows.find((row) => row.source === normalizedLegal);
    if (!legalReport) {
      failures.push(`legal route ${normalizedLegal} is missing from top-25 report set.`);
      continue;
    }
    if (legalReport.result !== 'PASS') {
      failures.push(`legal route ${normalizedLegal} is not explicitly handled.`);
    }
    if (legalReport.handling === 'redirected' && normalizePathname(legalReport.destination) === '/') {
      failures.push(`legal route ${normalizedLegal} redirects to home; it must resolve to explicit legal content.`);
    }
  }

  const passed = reportRows.filter((row) => row.result === 'PASS').length;
  const markdown = [
    '# GAM-25 Top-25 Parity Report',
    '',
    `- Source CSV: \`${path.relative(ROOT, top25CsvPath)}\``,
    `- Redirect file: \`${path.relative(ROOT, redirectsPath)}\``,
    `- Built routes checked: ${routeSet.size}`,
    `- Result: ${passed}/${reportRows.length} PASS`,
    '',
    toMarkdownTable(reportRows),
    '',
  ].join('\n');

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, 'utf8');

  if (failures.length > 0) {
    console.error('Top-25 parity checks failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`Report written to ${path.relative(ROOT, reportPath)}.`);
    process.exit(1);
  }

  console.log(`Top-25 parity checks passed (${passed}/${reportRows.length}).`);
  console.log(`Report written to ${path.relative(ROOT, reportPath)}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
