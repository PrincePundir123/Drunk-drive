# Restyle results

## Tests: before vs after

| Suite | Before | After |
|---|---|---|
| Unit tests | 38 pass, 0 fail | 38 pass, 0 fail |
| e2e (core flow) | 43 checks | 43 checks |
| night-e2e | 28 checks | 28 checks |
| rides-e2e | 15 checks | 15 checks |
| kb-e2e (keyboard only, visible focus) | 18 checks | 18 checks |
| study-e2e | 6 checks | 6 checks |
| contact-e2e | 23 checks | 23 checks |
| ext-e2e | 34 checks | 34 checks |
| axe (24 states, 360 + 1280px) | 0 violations | 0 violations |
| 200% zoom and 320px reflow | no sideways scroll | no sideways scroll |
| Console errors | none | none |

The first "after" run of e2e failed at the calibrate step. The cause was new landing copy: a decorative chip read "Baseline saved", the exact text the test waits for after calibration. The chip was renamed to "Your sober baseline", and e2e then passed all 43 checks. No app logic changed.

## Lighthouse (mobile)

| Page | Before (perf / a11y) | After (perf / a11y) |
|---|---|---|
| index.html | 99 / 100 | 99 / 100 |
| contact.html | 99 / 100 | 100 / 100 |
| study.html | 100 / 100 | 100 / 100 |

Best practices is 100 on every page. SEO is 100 on index; contact and study score 50, the same as before.

## Images

- Before: `docs/restyle/before/` (360, 768, 1280px)
- After: `docs/restyle/after/`
- Side by side: `docs/restyle/compare/` (104 images: every screen at 360 and 1280px)

The screenshot script couldn't capture two states:
- "Baseline saved" at 768 and 1280px, in both runs (a timing issue in the script)
- The contact alert at 1280px in the after run (the ntfy relay didn't answer in time)

The e2e and contact suites cover both of these states, and they passed.
