# GAM-17 Marketing Performance Hardening Summary

Date: 2026-02-18

## Scope delivered

- Switched font loading from CSS `@import` to `<link rel="preconnect">` + `<link rel="stylesheet">` in the document head.
- Deferred hero background video source attachment until idle time and only on non-mobile/non-reduced-motion contexts.
- Moved home interaction scripts out of inline HTML into cacheable static assets:
  - `public/scripts/home-interactions.js`
  - `public/scripts/load-section-particles.js`
- Updated particles runtime to only animate when visible and to pause when tab visibility changes.
- Added repeatable build profiling tool:
  - `scripts/profile-marketing-build.mjs`
  - `npm run profile:marketing`

## Baseline vs current

Baseline snapshot captured before hardening from local build output.

| Metric | Baseline | Current | Delta |
| --- | ---: | ---: | ---: |
| Largest HTML page (`index.html`) | 42,300 B | 38,661 B | -3,639 B |
| Total HTML bytes (22 pages) | 307,779 B | 307,689 B | -90 B |
| Runtime inline JS bytes (excluding JSON-LD) | 3,745 B | 0 B | -3,745 B |
| Total CSS bytes | 30,899 B | 30,809 B | -90 B |

Current build profile also reports all configured budgets passing.

## Runtime behavior checks

- Homepage hero video now renders with `data-video-src` and no eager `<source>` tag in static HTML.
- Particle loader and home interactions scripts are only referenced on `index.html`.
- Particle animation work now gates on viewport intersection + document visibility.

## Commands run

```sh
npm run build
npm run profile:marketing
```
