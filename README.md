# Gameye Astro Marketing

Astro-based marketing site scaffold for `gameye.com` with reusable homepage sections, pricing estimator, comparison pages, and SEO metadata.

## Local development

```sh
npm install
npm run dev
```

## Build and profile

```sh
npm run build
npm run profile:marketing
```

The profiling command writes:

- `reports/performance/marketing-build-profile.json`
- `reports/performance/marketing-build-profile.md`

These reports track HTML/JS/CSS footprint and budget checks to support CWV hardening work.

## Scripts

- `npm run dev`: start local dev server
- `npm run build`: production build to `dist/`
- `npm run preview`: preview built site
- `npm run profile:marketing`: generate build footprint report
- `npm run check:parity`: validate `llms.txt`, sitemap outputs, and docs bridge parity
- `npm run check:launch`: run launch QA checks for links, sitemap, bridge routes, and analytics events

## AI Chatbot Integration (GAM-20)

The site includes a shared chatbot launcher (`/public/chatbot/chatbot-loader.js`) with:

- citation rendering for responses
- confidence thresholding and fallback routing
- analytics events via `window.dataLayer`

Environment variables:

- `PUBLIC_CHATBOT_ENABLED` (default: `false`)
- `PUBLIC_CHATBOT_API_ENDPOINT` (optional; when empty the loader uses a local fallback knowledge mode)
- `PUBLIC_CHATBOT_MIN_CONFIDENCE` (default: `0.62`)

## Unified Navigation + Cross-Linking (GAM-21)

This project now includes shared cross-site navigation patterns with `docs.gameye.com`:

- header links include canonical Docs + API paths
- docs bridge pages route to canonical docs destinations
- footer resources include direct docs, API, and troubleshooting links

## llms/sitemap parity automation (GAM-22)

`public/llms.txt` defines AI-ingestion anchors for the marketing site and canonical docs routes.

`npm run check:parity` enforces:

- required `llms.txt` URLs (sitemap, docs hub, docs canonical routes)
- sitemap expectations (`/docs/` included, noindex bridge pages excluded)
- docs bridge index links match canonical docs destinations

## Launch Readiness Automation (GAM-23)

Run after a production build:

```sh
npm run build
npm run check:launch
```

`npm run check:launch` enforces:

- no broken internal links or missing built assets
- sitemap include/exclude coverage for launch-critical routes
- noindex + canonical docs target behavior on docs bridge pages
- pricing estimator and chatbot analytics event instrumentation
