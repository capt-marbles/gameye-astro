// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const EXCLUDED_FROM_SITEMAP = new Set([
  '/docs/quickstart/',
  '/docs/api/',
  '/docs/integrations/',
  '/docs/operations/',
]);

const normalizePathname = (value) => {
  if (!value) return '/';
  return value.endsWith('/') ? value : `${value}/`;
};

// https://astro.build/config
export default defineConfig({
  site: 'https://gameye.com',
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = page.startsWith('http') ? new URL(page).pathname : page;
        return !EXCLUDED_FROM_SITEMAP.has(normalizePathname(pathname));
      },
    }),
  ],
});
