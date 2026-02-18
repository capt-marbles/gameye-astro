#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function parseArgs(argv) {
  const args = {
    distDir: 'dist',
    markdownPath: null,
    jsonPath: null,
  };

  for (const token of argv.slice(2)) {
    if (token.startsWith('--dist=')) {
      args.distDir = token.slice('--dist='.length);
      continue;
    }

    if (token.startsWith('--markdown=')) {
      args.markdownPath = token.slice('--markdown='.length);
      continue;
    }

    if (token.startsWith('--json=')) {
      args.jsonPath = token.slice('--json='.length);
      continue;
    }
  }

  return args;
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(filePath));
      continue;
    }

    files.push(filePath);
  }

  return files;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

const args = parseArgs(process.argv);
const distPath = path.resolve(process.cwd(), args.distDir);

if (!fs.existsSync(distPath)) {
  console.error(`Dist directory not found: ${distPath}`);
  process.exit(1);
}

const files = walkFiles(distPath);
const htmlFiles = files.filter((filePath) => filePath.endsWith('.html'));
const jsFiles = files.filter((filePath) => filePath.endsWith('.js'));
const cssFiles = files.filter((filePath) => filePath.endsWith('.css'));

let totalHtmlBytes = 0;
let runtimeInlineJsBytes = 0;
let jsonLdBytes = 0;
let externalScriptTags = 0;

const htmlPageStats = [];
const remoteMediaUrls = new Set();

for (const filePath of htmlFiles) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(distPath, filePath);
  const bytes = Buffer.byteLength(raw);
  totalHtmlBytes += bytes;

  let pageRuntimeInlineJsBytes = 0;

  for (const match of raw.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attributes = match[1] || '';
    const scriptBody = match[2] || '';

    if (/\ssrc\s*=/.test(attributes)) {
      externalScriptTags += 1;
      continue;
    }

    const size = Buffer.byteLength(scriptBody);

    if (/application\/ld\+json/.test(attributes)) {
      jsonLdBytes += size;
      continue;
    }

    runtimeInlineJsBytes += size;
    pageRuntimeInlineJsBytes += size;
  }

  for (const match of raw.matchAll(/https?:\/\/[^"'\s)]+/g)) {
    const url = match[0];
    if (/\.(mp4|webm|gif|png|jpe?g|webp|svg)(\?|$)/i.test(url)) {
      remoteMediaUrls.add(url);
    }
  }

  htmlPageStats.push({
    page: relativePath,
    bytes,
    runtimeInlineJsBytes: pageRuntimeInlineJsBytes,
  });
}

const jsAssetStats = jsFiles.map((filePath) => {
  const raw = fs.readFileSync(filePath);
  const bytes = raw.length;
  const gzipBytes = zlib.gzipSync(raw).length;

  return {
    file: path.relative(distPath, filePath),
    bytes,
    gzipBytes,
  };
});

const cssAssetStats = cssFiles.map((filePath) => {
  const raw = fs.readFileSync(filePath);
  const bytes = raw.length;
  const gzipBytes = zlib.gzipSync(raw).length;

  return {
    file: path.relative(distPath, filePath),
    bytes,
    gzipBytes,
  };
});

const totalJsBytes = jsAssetStats.reduce((sum, item) => sum + item.bytes, 0);
const totalJsGzipBytes = jsAssetStats.reduce((sum, item) => sum + item.gzipBytes, 0);
const totalCssBytes = cssAssetStats.reduce((sum, item) => sum + item.bytes, 0);
const totalCssGzipBytes = cssAssetStats.reduce((sum, item) => sum + item.gzipBytes, 0);

const sortedHtmlPages = [...htmlPageStats].sort((a, b) => b.bytes - a.bytes);
const sortedJsAssets = [...jsAssetStats].sort((a, b) => b.bytes - a.bytes);
const sortedCssAssets = [...cssAssetStats].sort((a, b) => b.bytes - a.bytes);

const budgets = {
  maxHtmlPageBytes: 50000,
  runtimeInlineJsBytes: 5000,
  totalJsBytes: 25000,
  totalCssBytes: 45000,
};

const budgetChecks = {
  maxHtmlPageBytes: (sortedHtmlPages[0]?.bytes ?? 0) <= budgets.maxHtmlPageBytes,
  runtimeInlineJsBytes: runtimeInlineJsBytes <= budgets.runtimeInlineJsBytes,
  totalJsBytes: totalJsBytes <= budgets.totalJsBytes,
  totalCssBytes: totalCssBytes <= budgets.totalCssBytes,
};

const report = {
  generatedAt: new Date().toISOString(),
  distPath,
  pages: {
    count: htmlFiles.length,
    totalHtmlBytes,
    largestPages: sortedHtmlPages.slice(0, 5),
  },
  scripts: {
    runtimeInlineJsBytes,
    jsonLdBytes,
    externalScriptTags,
    jsAssetCount: jsAssetStats.length,
    totalJsBytes,
    totalJsGzipBytes,
    largestJsAssets: sortedJsAssets.slice(0, 5),
  },
  styles: {
    cssAssetCount: cssAssetStats.length,
    totalCssBytes,
    totalCssGzipBytes,
    largestCssAssets: sortedCssAssets.slice(0, 5),
  },
  remoteMedia: {
    uniqueCount: remoteMediaUrls.size,
    sample: Array.from(remoteMediaUrls).slice(0, 10),
  },
  budgets,
  budgetChecks,
  allBudgetsPassing: Object.values(budgetChecks).every(Boolean),
};

const markdownLines = [
  '# Marketing Build Profile',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  '',
  '| Metric | Value | Budget | Status |',
  '| --- | ---: | ---: | :---: |',
  `| Largest HTML page | ${formatBytes(sortedHtmlPages[0]?.bytes ?? 0)} | ${formatBytes(budgets.maxHtmlPageBytes)} | ${budgetChecks.maxHtmlPageBytes ? 'PASS' : 'FAIL'} |`,
  `| Runtime inline JS | ${formatBytes(runtimeInlineJsBytes)} | ${formatBytes(budgets.runtimeInlineJsBytes)} | ${budgetChecks.runtimeInlineJsBytes ? 'PASS' : 'FAIL'} |`,
  `| Total first-party JS | ${formatBytes(totalJsBytes)} | ${formatBytes(budgets.totalJsBytes)} | ${budgetChecks.totalJsBytes ? 'PASS' : 'FAIL'} |`,
  `| Total CSS | ${formatBytes(totalCssBytes)} | ${formatBytes(budgets.totalCssBytes)} | ${budgetChecks.totalCssBytes ? 'PASS' : 'FAIL'} |`,
  '',
  `All budgets passing: ${report.allBudgetsPassing ? 'yes' : 'no'}`,
  '',
  '## Largest HTML Pages',
  '',
  '| Page | HTML size | Runtime inline JS |',
  '| --- | ---: | ---: |',
  ...sortedHtmlPages.slice(0, 5).map((entry) => `| ${entry.page} | ${formatBytes(entry.bytes)} | ${formatBytes(entry.runtimeInlineJsBytes)} |`),
  '',
  '## Largest JS Assets',
  '',
  '| File | Raw size | Gzip size |',
  '| --- | ---: | ---: |',
  ...sortedJsAssets.slice(0, 5).map((entry) => `| ${entry.file} | ${formatBytes(entry.bytes)} | ${formatBytes(entry.gzipBytes)} |`),
  '',
  '## Largest CSS Assets',
  '',
  '| File | Raw size | Gzip size |',
  '| --- | ---: | ---: |',
  ...sortedCssAssets.slice(0, 5).map((entry) => `| ${entry.file} | ${formatBytes(entry.bytes)} | ${formatBytes(entry.gzipBytes)} |`),
  '',
  '## Remote Media URLs',
  '',
  `Detected: ${report.remoteMedia.uniqueCount}`,
  '',
  ...report.remoteMedia.sample.map((url) => `- ${url}`),
];

const markdown = `${markdownLines.join('\n')}\n`;

console.log(JSON.stringify(report, null, 2));

if (args.jsonPath) {
  const outputPath = path.resolve(process.cwd(), args.jsonPath);
  ensureDirectory(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (args.markdownPath) {
  const outputPath = path.resolve(process.cwd(), args.markdownPath);
  ensureDirectory(outputPath);
  fs.writeFileSync(outputPath, markdown, 'utf8');
}
