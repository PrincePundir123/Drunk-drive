# Baseline results (before the restyle)

Recorded on 2026-09-29 on commit `9fe86ed` (the blue restyle), before any coral changes. These results must be identical after the restyle.

| Suite | Result |
|---|---|
| Unit tests (`npm test`, node:test) | 38 tests, 38 pass, 0 fail |
| `e2e` (core flow: setup → baseline → messages → prompt → check-in → alert → settings) | 43 checks pass, no console or page errors |
| `night-e2e` (Night Out, reminders, home safe) | 28 checks pass, no errors |
| `rides-e2e` (ride links, plan-first ride button) | 15 checks pass, no errors |
| `kb-e2e` (keyboard-only walkthrough, visible focus) | 18 checks pass, no errors |
| `study-e2e` (validation study page) | 6 checks pass, no errors |
| `contact-e2e` (encrypted contact view, two-way replies) | 23 checks pass, no errors |
| `ext-e2e` (browser extension prompt and popup) | 34 checks pass, no errors |
| axe-core (24 states at 360 and 1280px) | 0 violations, no console errors |
| Zoom and reflow (640px = 200% zoom, 320px) | No sideways scroll, no clipped buttons |

## Lighthouse (mobile), same code, run earlier the same day

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `index.html` | 99 | 100 | 100 | 100 |
| `contact.html` | 99 | 100 | 100 | 50* |
| `study.html` | 100 | 100 | 100 | 50* |

*The contact and study pages score 50 on SEO; this is unchanged by the restyle.

The browser suites live outside the repo, in the session scratchpad (Playwright + Edge), as in earlier phases.
