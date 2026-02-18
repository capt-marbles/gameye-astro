import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  DEFAULT_CLOUDFLARE_REDIRECTS_PATH,
  DEFAULT_REDIRECT_CSV_PATH,
  loadRedirectRows,
  renderCloudflareRedirects,
  validateRedirectRows,
} from './lib/cloudflare-redirects.mjs';

function getArg(flag, fallbackValue) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return fallbackValue;
  return process.argv[index + 1];
}

async function main() {
  const csvPath = path.resolve(getArg('--input', DEFAULT_REDIRECT_CSV_PATH));
  const outputPath = path.resolve(getArg('--output', DEFAULT_CLOUDFLARE_REDIRECTS_PATH));

  const rows = await loadRedirectRows(csvPath);
  const failures = validateRedirectRows(rows);
  if (failures.length > 0) {
    console.error('Cloudflare redirect generation failed validation:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const output = renderCloudflareRedirects(rows, csvPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, 'utf8');

  console.log(
    `Generated ${rows.length} Cloudflare redirect rules at ${path.relative(process.cwd(), outputPath)} from ${path.relative(process.cwd(), csvPath)}.`
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
