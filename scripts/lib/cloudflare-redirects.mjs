import path from 'node:path';
import { readFile } from 'node:fs/promises';

const SAME_SITE_HOSTS = new Set(['gameye.com', 'www.gameye.com']);

export const DEFAULT_REDIRECT_CSV_PATH = path.join(
  process.cwd(),
  'redirects',
  'gameye-redirects-import-2026-02-18.csv'
);
export const DEFAULT_CLOUDFLARE_REDIRECTS_PATH = path.join(process.cwd(), 'public', '_redirects');

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

    if (ch === '\r') {
      continue;
    }

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

function normalizePathToken(rawValue, fieldName, rowNumber) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) {
    throw new Error(`Row ${rowNumber}: missing ${fieldName}`);
  }

  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    const pathname = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
    const withSearch = `${pathname}${url.search || ''}`;
    if (SAME_SITE_HOSTS.has(url.hostname.toLowerCase())) {
      return withSearch;
    }
    return `${url.origin}${withSearch}`;
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
}

function normalizeStatus(rawStatus, rowNumber) {
  const parsed = Number.parseInt(String(rawStatus ?? '301'), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: invalid status_code "${rawStatus}"`);
  }
  return parsed;
}

function isInternalTarget(value) {
  return value.startsWith('/');
}

export async function loadRedirectRows(csvPath = DEFAULT_REDIRECT_CSV_PATH) {
  const csv = await readFile(csvPath, 'utf8');
  const rows = parseCsv(csv);
  const parsedRows = [];
  const failures = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const source = normalizePathToken(row.source_url, 'source_url', rowNumber);
      const target = normalizePathToken(row.target_url, 'target_url', rowNumber);
      const status = normalizeStatus(row.status_code, rowNumber);

      parsedRows.push({
        rowNumber,
        source,
        target,
        status,
        sourceUrl: String(row.source_url ?? '').trim(),
        targetUrl: String(row.target_url ?? '').trim(),
      });
    } catch (error) {
      failures.push(error.message || String(error));
    }
  });

  if (failures.length > 0) {
    throw new Error(`Failed to parse redirect CSV:\\n- ${failures.join('\\n- ')}`);
  }

  return parsedRows;
}

export function validateRedirectRows(rows) {
  const failures = [];
  const sourceMap = new Map();
  const sourceSet = new Set();

  for (const row of rows) {
    if (!row.source.startsWith('/')) {
      failures.push(`row ${row.rowNumber}: source must be an internal path (${row.source})`);
    }
    if (row.status !== 301) {
      failures.push(`row ${row.rowNumber}: only 301 redirects are allowed (found ${row.status})`);
    }

    if (sourceMap.has(row.source)) {
      failures.push(
        `row ${row.rowNumber}: duplicate source "${row.source}" (already defined on row ${sourceMap.get(row.source)})`
      );
      continue;
    }

    sourceMap.set(row.source, row.rowNumber);
    sourceSet.add(row.source);

    if (row.source === row.target) {
      failures.push(`row ${row.rowNumber}: self redirect "${row.source}" -> "${row.target}"`);
    }
  }

  for (const row of rows) {
    if (!isInternalTarget(row.target)) {
      continue;
    }

    if (sourceSet.has(row.target)) {
      failures.push(
        `row ${row.rowNumber}: redirect chain detected "${row.source}" -> "${row.target}" (target is also a source)`
      );
    }
  }

  return failures;
}

export function renderCloudflareRedirects(rows, sourceCsvPath = DEFAULT_REDIRECT_CSV_PATH) {
  const lines = [
    '# Auto-generated file for Cloudflare Pages redirects.',
    `# Source CSV: ${path.relative(process.cwd(), sourceCsvPath)}`,
    '# Do not edit manually. Run: npm run build:redirects',
    '',
    ...rows.map((row) => `${row.source} ${row.target} ${row.status}`),
    '',
  ];
  return lines.join('\n');
}

export function parseCloudflareRedirects(text) {
  const entries = [];
  const failures = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      failures.push(`line ${lineNumber}: expected "source target status" format`);
      return;
    }

    const source = parts[0];
    const target = parts[1];
    const statusToken = parts[2].replace(/!$/, '');
    const status = Number.parseInt(statusToken, 10);

    if (!Number.isInteger(status)) {
      failures.push(`line ${lineNumber}: invalid status code "${parts[2]}"`);
      return;
    }

    entries.push({ lineNumber, source, target, status });
  });

  return { entries, failures };
}
