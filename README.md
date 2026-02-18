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
