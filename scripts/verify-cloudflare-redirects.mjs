import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { DEFAULT_REDIRECT_CSV_PATH, loadRedirectRows } from './lib/cloudflare-redirects.mjs';

function getArg(flag, fallbackValue) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return fallbackValue;
  return process.argv[index + 1];
}

function normalizeComparableUrl(raw) {
  const url = new URL(raw);
  if (url.pathname.endsWith('/') && url.pathname !== '/') {
    url.pathname = url.pathname.slice(0, -1);
  }
  url.hash = '';
  return `${url.origin}${url.pathname}${url.search}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const csvPath = path.resolve(getArg('--input', DEFAULT_REDIRECT_CSV_PATH));
  const baseUrl = getArg('--base-url', 'https://gameye.com');
  const outputPath = path.resolve(
    getArg(
      '--output',
      path.join(
        process.cwd(),
        'reports',
        'redirects',
        `cloudflare-redirect-verification-${new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '')}.csv`
      )
    )
  );

  const rows = await loadRedirectRows(csvPath);
  const results = [];
  let passed = 0;

  for (const row of rows) {
    const sourceUrl = new URL(row.source, baseUrl).toString();
    const expectedTarget = row.target.startsWith('/') ? new URL(row.target, baseUrl).toString() : row.target;

    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'user-agent': 'gameye-redirect-verifier/1.0',
        },
      });

      const location = response.headers.get('location') || '';
      const resolvedLocation = location ? new URL(location, sourceUrl).toString() : '';
      const statusMatch = response.status === row.status;
      const locationMatch =
        normalizeComparableUrl(resolvedLocation || sourceUrl) === normalizeComparableUrl(expectedTarget);
      const pass = statusMatch && locationMatch;
      if (pass) passed += 1;

      results.push({
        source_url: sourceUrl,
        expected_target: expectedTarget,
        expected_status: row.status,
        observed_status: response.status,
        observed_location: resolvedLocation,
        pass: pass ? 'yes' : 'no',
        error: '',
      });
    } catch (error) {
      results.push({
        source_url: sourceUrl,
        expected_target: expectedTarget,
        expected_status: row.status,
        observed_status: '',
        observed_location: '',
        pass: 'no',
        error: error.message || String(error),
      });
    }
  }

  const header = [
    'source_url',
    'expected_target',
    'expected_status',
    'observed_status',
    'observed_location',
    'pass',
    'error',
  ];

  const body = results.map((result) => header.map((key) => csvEscape(result[key])).join(',')).join('\n');
  const csv = `${header.join(',')}\n${body}\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, 'utf8');

  const failed = results.length - passed;
  if (failed > 0) {
    console.error(`Redirect verification failed: ${failed}/${results.length} mappings did not match expectations.`);
    console.error(`Detailed report: ${path.relative(process.cwd(), outputPath)}`);
    process.exit(1);
  }

  console.log(`Redirect verification passed: ${passed}/${results.length} mappings validated.`);
  console.log(`Detailed report: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
