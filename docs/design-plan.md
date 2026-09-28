# Design plan: one product, two modes

## Subject and audience

SecondLook is used by the same person in two very different states.

In Sober Mode (landing, setup, baseline, dashboard, log, settings), the user is clear-headed, usually in daylight, often at a desk. The job is to make a plan and trust the app with it. There's room for some detail, and the tone is calm, specific and trustworthy.

In Night Mode (the second-look prompt, check-in, alert, ride, Night Out reminders, and the contact's view), the user may be tired or impaired, at 2am, holding a drink in one hand, in a dark bar. The job is to take one good action with one thumb. There's one primary action per screen and it sits in the bottom thumb zone. Targets are at least 56px, and the primary one is 64px. Sentences are short, body text is 20px and key text 32px, and the user's own words and plan come first. It's calm, never alarming, never shaming.

The two modes should feel like the same product at a different time of day. The sober app is daylight: that's where you make the plan. Night Mode is the same shapes under streetlight.

The app switches automatically. The prompt, check-in, alert, reminders and contact view are always Night Mode. The dashboard and messages switch to Night Mode while a Night Out is active or something was flagged in the last 6 hours, and they say so in one line ("Night Mode is on while your Night Out is active").

## Colour

### Sober Mode: "Daylight"

| Token | Hex | Use | Contrast |
|---|---|---|---|
| paper | `#F2F4F1` | page background (a cool mist, not cream) | — |
| surface | `#FFFFFF` | raised areas, inputs | — |
| ink | `#152019` | text | 15.2 on paper (AAA) |
| ink-2 | `#4A5650` | secondary text | 6.9 on paper (AA) |
| brand ("dusk") | `#2F3E9E` | primary buttons, links, focus | 8.2 on paper; white text on it 9.1 |
| ok / warn / danger | `#1E6B45` / `#8A5300` / `#A8231B` | status only | 5.9 / 5.7 / 6.5 on paper |

### Night Mode: "Streetlight"

| Token | Hex | Use | Contrast |
|---|---|---|---|
| night | `#111317` | background (neutral charcoal, not navy) | — |
| night-surface | `#1B1E24` | panels | — |
| night-ink | `#F4EFE6` | text (warm white, not blue-white glare) | 16.2 on night (AAA) |
| night-ink-2 | `#C9C1B3` | secondary text | 10.4 (AAA) |
| amber | `#FFBE55` | the one primary action, countdown | 11.3; dark ink `#1A1204` on it 11.3 |
| night-ok / night-danger | `#8EDDB0` / `#FF9E8F` | replies, 112 | 11.6 / 9.3 (AAA) |

Why amber: it's the colour of sodium streetlights, it's calmer than red, and warm light disturbs dark-adapted eyes less than blue-white. Red is reserved for 112 only, and even there it's a soft coral, not a siren.

## Type

We use two faces, both self-hosted as woff2 in `assets/fonts/` and cached by the service worker. No font CDN.

- **Atkinson Hyperlegible** (Braille Institute) is for body text in both modes and all Night Mode text. It was designed for low-vision readers, with letterforms that don't get confused with each other (I/l/1, 0/O, b/d/p/q). That's exactly the reader at 2am.
- **Bricolage Grotesque** (variable) is for Sober Mode headings only. It's a warm, slightly irregular grotesque that gives the daylight screens a voice. Night Mode deliberately drops it: at night, legibility beats personality.

| Step | Sober | Night |
|---|---|---|
| small | 14px | 16px |
| body | 17px | 20px |
| lead | 20px | 24px |
| h2 | 24px | 28px |
| h1 | 34px (mobile) / 48px (desktop) | 32px |
| display | 56–72px (landing hero) | 72px (countdown numerals) |

## Layout

The landing leads with the product's most characteristic moment. It's a live mini-demo in a phone frame: a message gets typed, you press send, and the second-look sheet rises. That's the page's one orchestrated animation.

```
mobile                               desktop (≥ 960)
┌──────────────────────┐            ┌──────────────────────────────────────────────┐
│ ◉ SecondLook   [Try] │            │ ◉ SecondLook                 Try demo  Set up │
│                      │            │                                              │
│ The pause before a   │            │ The pause before a     ┌──────────────────┐  │
│ bad decision.        │            │ bad decision.          │ phone mini-demo  │  │
│ 2-line promise       │            │ 2-line promise         │ "heyy im fnie…"  │  │
│ [Try the demo]       │            │ [Try the demo] Set up  │ ▔▔ second look ▔ │  │
│ ┌──phone mini-demo─┐ │            │                        └──────────────────┘  │
│ └──────────────────┘ │            │ ── one big number, one sentence ──────────── │
│ 1 every 39 minutes   │            │ Day | Night explainer (two columns)          │
│ Day / Night explainer│            │ The promise (4 short lines)                  │
│ The promise          │            └──────────────────────────────────────────────┘
└──────────────────────┘
```
Reason: show the moment, then the reason, then the promise.

The dashboard's hero is the status eye. Everything else is secondary.

```
mobile                          desktop
┌────────────────────────┐     ┌──────────────────────────────────────────┐
│ ◉ SecondLook           │     │ ◉ SecondLook   Home Messages Check Log ⚙ │
│      ( ◉ eye )         │     │ ( ◉ eye )  All quiet tonight.            │
│  All quiet tonight.    │     │            One-line detail.              │
│  one-line detail       │     │ [Going out tonight?] [Quick check] [Ride]│
│ [Going out tonight?]   │     │ ▸ Your safety net                        │
│ [Quick check] [Ride]   │     │ ▸ Your sober baseline                    │
│ ▸ Your safety net      │     │ ▸ Tonight                                │
│ ▸ Your sober baseline  │     └──────────────────────────────────────────┘
│ ▸ Tonight              │
│ ⌂  ✉  ♡  ≡  ⚙ (tabs)   │
└────────────────────────┘
```
Reason: status first, 2–3 actions, details on demand.

The second-look prompt is a Night Mode bottom sheet at every width (anchored bottom-centre, max 520px on desktop).

```
┌────────────────────────┐
│  (chat, dimmed)        │
│┌──────────────────────┐│
││ ◉  Want a second      ││
││    look?              ││
││ This doesn't look     ││
││ like how you text.    ││
││ “You planned an Uber” ││
││ ────────────────────  ││
││ Checking in with you  ││
││ in 18s  ▰▰▰▰▱▱▱       ││
││ [ Edit my message   ] ││ 64px
││ [ Send it anyway    ] ││ 56px
││   Check how I'm doing ││ text button
│└──────────────────────┘│
└────────────────────────┘
```
Reason: one decision, thumb zone, reasons in plain words, countdown you can't miss.

The check-in fills the screen in Night Mode. The eye's iris is the countdown.

```
┌────────────────────────┐
│ SecondLook    [112 ⚠]  │  112: visible, small, behind a confirm
│       ( ◉ )  28        │  eye + numeral
│ Hey Alex.              │
│ Just checking in.      │
│ ┌ You planned: Uber ┐  │  own words first
│ │ “Don't drive…”     │  │
│ └────────────────────┘  │
│ If you don't answer,   │
│ Priya gets a message.  │
│ [ Book a ride home   ] │  64px, amber
│ [ Call Priya ][ Text ] │  56px
│   I'm okay: 15-sec test │  text button
└────────────────────────┘
```
Reason: ride and contact are the biggest and lowest. 112 is always visible but can't be hit by accident.

Settings are grouped sections with a sticky section index on desktop (a chip row on mobile). The lock is a band at the top, and every locked section shows a lock label.

```
mobile                          desktop
┌────────────────────────┐     ┌───────────┬──────────────────────────────┐
│ Settings               │     │ You       │ 🔒 Locked until 3:40 AM      │
│ [You][Alerts][Rides].. │     │ Alerts    │    why · [Unlock: 15s check] │
│ 🔒 Locked until 3:40   │     │ Rides     │ You and your contact         │
│  [Unlock with a check] │     │ Extension │  fields…                     │
│ You and your contact   │     │ Baseline  │ How SecondLook responds      │
│ …                      │     │ Data      │ …                            │
└────────────────────────┘     └───────────┴──────────────────────────────┘
```
Reason: seven cards become one page with a map, and the lock is where your eyes are.

## Signature element: the eye

The logo (an eye with a pause in the pupil) becomes the product's status. It's one inline SVG component with three jobs:

- On the dashboard it's the hero. The iris colour and the lid show the state: open and green-grey when quiet, the lid half-lowered and warm when a bit different, lower and coral for "please don't drive tonight".
- In the check-in, the iris ring is the countdown and drains as time passes. There's no separate ring chart.
- In the quick check result, the iris fill is the score.

Everything around it stays quiet: flat surfaces, no gradients, one accent per mode.

## Motion

There's one orchestrated moment, the landing mini-demo: a message types itself and the sheet rises. Everything else responds to the user: the prompt sheet slides up after you press send, and the countdown drains. `prefers-reduced-motion` shows the final state with no animation.

## Review against generic AI-looking defaults (and what changed)

| Generic default | Were we doing it? | Change |
|---|---|---|
| Near-black background with one neon accent | Yes: navy with mint, everywhere | Sober Mode is now a light daylight palette with an indigo "dusk" brand. Night Mode is charcoal with a streetlight amber. The pairing carries meaning. |
| Warm cream background, serif, terracotta accent | Nearly, in the first sketch (a cream day palette) | Switched to a cool mist `#F2F4F1` and indigo, and a grotesque instead of a serif. |
| Identical rounded cards with the same grey shadow | Yes: 7 cards per screen | Sections are separated by space and hairlines. Only interactive or grouped things get a surface. No drop shadows except the sheet. |
| Gradient washes | Yes: two radial glows behind the page | Removed. Flat colour only. |
| ALL-CAPS eyebrow labels above headings | Yes, everywhere | Removed. Context goes in the heading or a sentence-case line. |
| "A · B · C" meta strings | Yes (baseline "created · learned", check result) | Rewritten as sentences. |
| → on every button | On some ("Change in settings →", "Here it is →") | Removed from buttons. Kept only once, in the user's own plan line, where it reads as speech. |
| Numbered 01/02/03 on non-sequences | "How it works" 1–4 badges | Removed. Numbers stay only on real sequences: setup steps and baseline tasks. |
| Fade-slide-up on every section | Every modal rose and faded | One orchestrated moment. Dialogs appear without flourish. |
| Emoji as icons | Everywhere | A small set of consistent line icons (inline SVG, `currentColor`). |
