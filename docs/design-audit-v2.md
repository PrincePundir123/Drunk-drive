# Design audit v2: a judge's-eye review of UI v1

v1 is the "daylight / streetlight" redesign. Screenshots of every item below at 360, 768 and 1280 px are in `docs/screenshots/after/` (main screens, `01`–`26`) and `docs/screenshots/v1-states/` (every other modal, sheet, toast and state, `s02`–`s31`). The one exception is `s08`, the baseline-saved screen, which is noted in the checklist below.

## Checklist: every route, modal, sheet, toast and state

Found by reading `js/app.js`, `js/contact.js`, `js/study.js`, `index.html`, `contact.html`, `study.html` and `extension/`.

### Web app routes (`#/…`)
| # | Item | Screenshot |
|---|---|---|
| 1 | Landing (`#/welcome`) with the phone mini-demo | after/01-landing |
| 2 | Setup step 1: name (and the empty-name error) | after/02-setup, after/03-setup-error |
| 3 | Setup step 2: safe contact | v1-states/s02-setup-step2 |
| 4 | Setup step 3: home address (with "Skip for now") | v1-states/s03-setup-step3 |
| 5 | Setup step 4: promises | v1-states/s04-setup-step4 |
| 6 | Calibrate intro (step 5) and recalibrate variant | after/04-calibrate-intro |
| 7 | Reaction task: idle, wait, go, too-soon, result, done | after/05-task-reaction, s05-reaction-wait, s06-reaction-go, s07-reaction-early |
| 8 | Steady-hand task (and "skip this task") | after/06-task-tracking |
| 9 | Typing task (sentence 1 and 2, paste blocked) | after/07-task-typing |
| 10 | Baseline saved | covered by the browser tests (the capture script couldn't re-enter it) |
| 11 | Home: quiet (Sober Mode) | after/08-home-quiet |
| 12 | Home: a bit different (Sober Mode) | v1-states/s09-home-day-caution |
| 13 | Home: please don't drive (Night Mode) | after/09-home-night-flagged |
| 14 | Home: Night Out active (Night Mode, plan card, Home safe) | v1-states/s10-home-night-out |
| 15 | Home: demo bar, expanders (Tonight / safety net / baseline) | after/08, 09 |
| 16 | Messages: seeded chat, sent message, "sent after a second look" | after/10-messages, s25-chat-sent-after-look |
| 17 | Quick check intro, tasks, result: like you / a bit different / quite different (simulated) | after/16, 17, v1-states/s13-check-result-ok |
| 18 | Log: grouped by night | after/18-log |
| 19 | Log: empty | v1-states/s14-log-empty |
| 20 | Settings: normal, contact link off | after/19-settings |
| 21 | Settings: contact link on (QR, share, test, reset), extension code shown | v1-states/s16-settings-link-on |
| 22 | Settings: locked band | after/20-settings-locked |

### Sheets and dialogs
| # | Item | Screenshot |
|---|---|---|
| 23 | Second-look sheet (Night Mode) | after/11-second-look |
| 24 | Get home safe: day dialog and night sheet | s11-help-sheet-day, s12-help-sheet-night |
| 25 | Going out tonight (Night Out form) | after/21-night-form |
| 26 | Night Out reminder sheet | after/22-night-reminder |
| 27 | Phone reminders (ntfy topic) dialog | not captured (needs a live schedule); same component as 25 |
| 28 | Unlock with a quick test (settings lock) | v1-states/s17-unlock-modal |
| 29 | Quick check before ending Night Out | v1-states/s18-homesafe-prove |
| 30 | Import extension log (with error) | v1-states/s15-log-import |
| 31 | Call 112? confirm sheet | v1-states/s20-emergency-confirm |
| 32 | Native confirm() dialogs: exit demo, delete data, clear log, reset link | browser chrome, not styled |

### Check-in overlay (full Night Mode)
| # | Item | Screenshot |
|---|---|---|
| 33 | Asking (countdown, plan first, "Open Uber, like you planned") | after/12-checkin |
| 34 | Asking with a contact reply banner | v1-states/s19-checkin-reply |
| 35 | Proving (15-second reaction test) | after/13-checkin-proving |
| 36 | Alerted: delivered / not set up / delivery failed | after/14-alert, s21-alert-not-pushed, s22-alert-push-failed |
| 37 | Expired (auto-alert off) | v1-states/s23-checkin-expired |
| 38 | Responded ("Good call") | after/15-responded |

### Toasts
| # | Item | Screenshot |
|---|---|---|
| 39 | Demo loaded, Saved, No changes, Code/link copied, Home address copied, tips, Welcome home, Unlocked | v1-states/s24-toast |

### Contact view (`contact.html`)
| # | Item | Screenshot |
|---|---|---|
| 40 | No link / key missing | v1-states/s26-contact-nolink |
| 41 | Idle and listening | after/23-contact-idle |
| 42 | Test alert / urgent alert, reply buttons, rides, 112 confirm, "Sent" | v1-states/s27-contact-alert, s28 |
| 43 | Offline, reconnecting, decrypt-failed banners | covered by contact-e2e |

### Study (`study.html`)
| # | Item | Screenshot |
|---|---|---|
| 44 | Intro and consent (and code error) | after/24-study, v1-states/s30-study-error |
| 45 | Resume session, round intro (each condition), tired self-report, finish | v1-states/s29-study-round |

### Extension
| # | Item | Screenshot |
|---|---|---|
| 46 | Popup: not set up, all quiet, a bit off, don't drive, paused, locked, per-site toggles, log | after/26-extension-popup |
| 47 | Prompt overlay on WhatsApp Web | after/25-extension-prompt, v1-states/s31-extension-overlay |
| 48 | "Couldn't press send for you" toast | same component as 47 |

## How a judge sees it (3 minutes, tired)

### First 5 seconds (landing)
"The pause before a bad decision" is a good line, but it's a slogan, not an explanation. The phone mock plays its little demo once, in a small dark rectangle that's mostly empty, with the sheet covering the typo-filled message it's supposed to be about. By the time the judge's eyes reach it, it may already have finished. The palette (mist grey and indigo) reads like a fintech or health template. Nothing here makes anyone say "wow". The most distinctive idea, a Night Mode that looks after you at 2am, sits two scrolls down in a pair of text boxes.

### First 30 seconds (to the core moment)
"Try the 2-minute demo" leads to a dashboard, not the moment. From there the judge has to read a demo bar ("open the contact view… then simulate a message in Messages"), open the Messages tab, find an underlined link that says "Simulate an impaired message", and wait for it to type. That's four steps and some reading. Most judges will never see the second-look prompt, which is the whole product.

### Gallery and demo video
The Night Mode screens (check-in, alert, sheet) are the most striking thing we have, and they photograph well. The Sober Mode screens are tidy but generic. As 3:2 thumbnails, none of them would stand out in a row of forty projects.

### Where it still looks like a template or lacks polish
- Rounded bordered boxes still carry most of the hierarchy: the plan card, demo bar, lock band, actions, contact panels and alert cards all use the same shape.
- The amber-tinted plan card on charcoal reads muddy brown, not warm.
- The eye signature is undersold: 34px in the header, a thin outline, static on the dashboard. It never visibly moves as an eye would, so the "living status" idea is invisible unless it's explained.
- Night Mode headings switch to bold Atkinson, and Sober Mode uses Bricolage, so the two modes look like two different products rather than one product at two times.
- Empty states are single grey lines ("Nothing yet.").
- The toast lands on top of whatever sits under the header, including form fields.
- There are no transitions between routes and nothing marks a change of mode. Day to night just flips.
- Secondary actions in the alert screen wrap awkwardly ("Ride / home").

## Top 10 problems, ranked by what they'd cost us with judges

1. **The core moment takes four steps and reading to reach.** A judge who never sees a message get paused has seen nothing unique. (Cost: the whole pitch.)
2. **The landing page doesn't show the product in the first five seconds.** The demo is small, plays once, and hides the message it's about. There's no "wow".
3. **The Sober Mode palette and components read as a generic SaaS template.** Mist grey with indigo and rounded bordered cards could be any fintech onboarding.
4. **The signature eye is invisible as a signature.** It's tiny and static, and doesn't react on screen, so "the eye is your status and your countdown" has to be explained instead of seen.
5. **The two modes don't feel like one brand.** Different heading faces, different accent logic, no transition between them.
6. **The gallery and cover images don't exist.** Devpost thumbnails will be raw screenshots.
7. **Too many bordered boxes carry the hierarchy.** Plan card, demo bar, lock band, action tiles and contact panels are all the same rounded, outlined shape.
8. **Muddy colour in Night Mode.** The amber-on-charcoal plan card turns brown, which dulls the calm, warm "streetlight" idea.
9. **Weak empty, error and toast states.** One grey line for an empty log, a toast that covers fields, native confirm() dialogs for destructive actions.
10. **Motion is flat.** The only orchestrated moment (the landing demo) is small and easy to miss, and the prompt sheet's rise isn't tied to the eye in any way.
