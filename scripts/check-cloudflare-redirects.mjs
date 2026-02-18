import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import {
  DEFAULT_CLOUDFLARE_REDIRECTS_PATH,
  DEFAULT_REDIRECT_CSV_PATH,
  loadRedirectRows,
  parseCloudflareRedirects,
  validateRedirectRows,
} from './lib/cloudflare-redirects.mjs';

function getArg(flag, fallbackValue) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return fallbackValue;
  return process.argv[index + 1];
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const csvPath = path.resolve(getArg('--input', DEFAULT_REDIRECT_CSV_PATH));
  const redirectsPath = path.resolve(getArg('--redirects', DEFAULT_CLOUDFLARE_REDIRECTS_PATH));
  const distRedirectsPath = path.resolve(getArg('--dist', path.join(process.cwd(), 'dist', '_redirects')));

  const rows = await loadRedirectRows(csvPath);
  const failures = validateRedirectRows(rows);

  if (!(await fileExists(redirectsPath))) {
    failures.push(
      `missing ${path.relative(process.cwd(), redirectsPath)} (run "npm run build:redirects" before validation)`
    );
  } else {
    const redirectsSource = await readFile(redirectsPath, 'utf8');
    const parsed = parseCloudflareRedirects(redirectsSource);
    failures.push(...parsed.failures);

    const entriesBySource = new Map();
    for (const entry of parsed.entries) {
      if (entriesBySource.has(entry.source)) {
        failures.push(
          `duplicate _redirects source "${entry.source}" on lines ${entriesBySource.get(entry.source).lineNumber} and ${entry.lineNumber}`
        );
        continue;
      }
      entriesBySource.set(entry.source, entry);
    }

    for (const row of rows) {
      const entry = entriesBySource.get(row.source);
      if (!entry) {
        failures.push(`missing _redirects rule for CSV source ${row.source}`);
        continue;
      }
      if (entry.target !== row.target) {
        failures.push(`target mismatch for ${row.source}: expected ${row.target}, found ${entry.target}`);
      }
      if (entry.status !== row.status) {
        failures.push(`status mismatch for ${row.source}: expected ${row.status}, found ${entry.status}`);
      }
    }

    for (const entry of parsed.entries) {
      if (!rows.some((row) => row.source === entry.source)) {
        failures.push(`unexpected _redirects source not in CSV map: ${entry.source}`);
      }
    }
  }

  if (await fileExists(distRedirectsPath)) {
    const publicContent = await readFile(redirectsPath, 'utf8');
    const distContent = await readFile(distRedirectsPath, 'utf8');
    if (publicContent !== distContent) {
      failures.push(
        `dist/_redirects does not match public/_redirects (run "npm run build" after generating redirects)`
      );
    }
  }

  if (failures.length > 0) {
    console.error('Cloudflare redirect checks failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Cloudflare redirect checks passed for ${rows.length} mappings (${path.relative(process.cwd(), redirectsPath)}).`
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
