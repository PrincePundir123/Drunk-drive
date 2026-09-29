# Restyle plan: warm coral

The reference language, from `reference-analysis.md`: a warm off-white canvas, white cards with hairlines, one coral accent, tinted pill labels, a left sidebar with icon tiles, a geometric sans with tight headlines, and generous spacing.

Only the look changes. Every hook in `protected-hooks.md` stays, and no logic file changes (metrics, storage, secure, relay, nightout, rides, study analysis, extension interception).

## 1. Tokens

### Colour, Sober Mode (`[data-mode="day"]`, the default)

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#FFFDF9` | warm canvas |
| `--surface` | `#FFFFFF` | cards |
| `--surface-2` | `#FAF7F4` | icon tiles, stat tiles, input fill |
| `--line` | `#EEE8E3` | 1px hairlines |
| `--text` | `#2C2C2C` | 13.8:1 |
| `--text-2` | `#6B6865` | 5.5:1 (the reference's `#817F7D` fails) |
| `--accent` | `#C63D1F` | buttons and links, white text 5.1:1 |
| `--accent-ink` | `#FFFFFF` | text on the accent |
| `--accent-bright` | `#FF6B4A` | decoration only: logo tile, icon circles, glow |
| `--accent-soft` | `#FFF5F3` | active nav row, pill fill, dropzone fill |
| `--pill-ink` | `#A8391F` | pill text, 6.0:1 on the tint |
| `--ok` | `#1F7A4D` | 5.2:1 |
| `--warn` | `#8A4B00` | 6.7:1 |
| `--danger` | `#B42318` | 6.5:1 |
| `--focus` | `#C63D1F` | |
| `--shadow-cta` | `0 8px 20px rgba(255,107,74,.28)` | primary button only |

### Colour, Night Mode (`[data-mode="night"]`)

The warm dark version. The Night Mode rules win: AAA contrast everywhere.

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#1C1917` | warm near-black |
| `--surface` | `#292524` | |
| `--surface-2` | `#3A3431` | |
| `--line` | `#4A433E` | |
| `--text` | `#FFFDF9` | 17.2:1 |
| `--text-2` | `#D6D0CB` | 11.5:1 on the background, 9.9:1 on surfaces |
| `--accent` | `#FFA58E` | light coral buttons |
| `--accent-ink` | `#1C1917` | dark text on them, 9.2:1 |
| `--link` | `#FFB4A2` | 10.3:1 |
| `--ok` / `--warn` / `--danger` | `#8BE0B5` / `#FFC56B` / `#FFA89A` | all 9:1+ |

### Type

| Use | Sober Mode | Night Mode |
|---|---|---|
| Display / headings / UI | **Outfit** (OFL, self-hosted), 600–700, tracking −0.03em | Outfit 600 |
| Body | Outfit 400 | **Atkinson Hyperlegible** 400/700 (kept for 2am legibility) |
| Body size | 17px | **20px** (rule: 18px+) |
| Lead | 20px, line-height 1.6 | 24px |
| h2 | clamp 28 → 44px | **28px** |
| h1 | clamp 34 → 56px | **32px** (rule: key text 28px+) |
| Hero display | clamp 40 → 76px | n/a |
| Small | 14px | 16px |

- **Font change:** the reference font isn't identified, so Outfit is the closest free match. Geist is removed.
- The Atkinson files stay (Night Mode, contact page).

### Spacing, radius, shadow, motion

- **Spacing:** the 4/8 scale stays (4, 8, 12, 16, 24, 32, 48, 64, 96). Section gaps on the landing page are 96px.
- **Radius:**

  | Element | Radius |
  |---|---|
  | Cards | 24px |
  | Dropzone / inner panels | 16px |
  | Buttons and inputs | 12px |
  | Nav row | 14px |
  | Icon tiles | 10px |
  | Pills and avatars | round |

- **Borders:** 1px `--line` on cards and inputs.
- **Shadows:** none on cards; only the coral CTA shadow. Night Mode has no shadows.
- **Motion:**
  - Cards lift 2px on hover.
  - The sheet rise and eye blink stay.
  - The "settling letters" effect is removed; it isn't part of this language.
  - Everything is off under `prefers-reduced-motion`.

## 2. App shell

- **Desktop (≥ 900px, Sober Mode):**
  - Top bar: the eye logo in a **coral rounded-square tile** with "SecondLook"; the demo pill on the right.
  - Below it, a **left sidebar** (260px) holding `#topnav`, restyled as a vertical list: each item has an icon tile, and the active row is coral-tint with coral text.
  - `#topnav` keeps its id and `aria-current` behaviour; it only moves into the sidebar column.
- **Mobile:** the top bar, plus the existing `#tabbar` at the bottom (unchanged hook), restyled with coral active state.
- **Landing (not signed up):** no sidebar. The top bar has a coral "Try the demo" button on the right, like "Sign in with Google" in ref 1.
- **Night Mode screens:** the same shell in the warm-dark palette. The sidebar stays on desktop but dims.

## 3. Screen by screen

| Screen | Change |
|---|---|
| Landing hero | Centred pill, huge centred headline, centred lead, faint coral/lilac glow, then a **big white "tool card"** holding the phone demo (left) and the two CTAs with trust notes (right), like ref 1's upload card |
| Landing: why it matters | Stat row as three white stat cards (big number + label) |
| Landing: how it works | Pill + centred h2, then **ref-2 split rows**: illustration card (the eye or a phone snippet in a tinted card) alternating left and right with pill + h3 + text |
| Landing: two modes | Two cards side by side: Sober (white) and Night (warm dark) |
| Landing: promise | **Ref-3 grid** of 4 white cards, each with a coral icon circle instead of stars/avatars |
| Landing: CTA | Coral-tint band with centred headline and buttons |
| `#/home` | Status card (white, 24px radius) with the eye; action cards in a 3-column grid with icon tiles; "More" sections as white cards |
| Setup / calibrate | White form card like ref 1: 56px inputs, 12px radius, coral primary; stepper in coral |
| Messages | White chat header card; bubbles: them = white with hairline, me = coral `#C63D1F` with white text; the composer looks like the ref 1 select |
| Check | White card with coral primary; task pads as white/tinted cards; the tracking canvas becomes warm-dark with coral |
| Log | One white card per night, icon tiles in the timeline |
| Settings | Sidebar section nav (like ref 1's sidebar) plus white group cards; the lock band is a warm-dark card |
| Second-look prompt | Warm-dark bottom sheet, eye, the user's own plan first, one light-coral 64px primary at the bottom |
| Check-in | Full warm-dark screen, big countdown, plan first, a 64px primary in the thumb zone, secondary actions below |
| Alert / reminders | Same Night Mode sheet style |
| Contact page | Night Mode: warm-dark cards, light-coral primary |
| Study page | Sober Mode form cards |
| Extension popup | Sober cards with coral |
| Extension overlay | Night Mode sheet, recoloured to warm dark + light coral |
| Icons | Favicon, PWA and extension icons become the eye on a coral `#FF6B4A` rounded tile. Theme colours: `#FFFDF9` (day), `#1C1917` (night). `sw.js` cache bumped. |

## 4. Wireframes

### Landing (desktop 1280)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [◉] SecondLook                                     [ Try the demo ]  │ top bar, hairline under
├──────────────────────────────────────────────────────────────────────┤
│                 ( A promise you make while sober )                   │ coral-tint pill
│                                                                      │
│             The pause before a bad decision.                         │ 76px, centred
│      Drinking breaks the very judgment you'd need to notice…         │ lead, muted, centred
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ┌──────────┐                                                    │  │ big white card
│  │ │  phone   │   ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │  │
│  │ │  demo    │     (●)  See it in 2 minutes                       │  │ dashed coral zone
│  │ │          │   │  Loads a sample night. Nothing is sent.    │    │  │
│  │ │          │    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │  │
│  │ └──────────┘   Free · runs in your browser · words stay on phone │  │
│  │                [ Set up SecondLook ]   [ Try the 2-minute demo ] │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│           ( Why it matters )   1 every 39 minutes                    │
│   ┌ 13,524 ────────┐ ┌ 32% ───────────┐ ┌ 2 min ──────────┐          │ stat cards
└──────────────────────────────────────────────────────────────────────┘
```

### `#/home` (desktop, Sober Mode)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [◉] SecondLook                                        Demo · Exit    │
├───────────────┬──────────────────────────────────────────────────────┤
│ ▣ Home  ◀tint │  ┌──────────────────────────────────────────────┐    │
│ ▢ Messages    │  │ (eye)  All quiet tonight                     │    │ status card
│ ▢ Check       │  │        Your messages are compared with…      │    │
│ ▢ Log         │  └──────────────────────────────────────────────┘    │
│ ▢ Settings    │  ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│               │  │ ▣          │ │ ▣          │ │ ▣          │        │ action cards
│               │  │ Going out  │ │ Get a ride │ │ Quick check│        │
│               │  │ tonight?   │ │ home       │ │            │        │
│               │  └────────────┘ └────────────┘ └────────────┘        │
│               │  ┌ Tonight ────────────────────── Nothing flagged ▾┐ │
│               │  ┌ Your safety net ────────────────────── Priya   ▾┐ │
└───────────────┴──────────────────────────────────────────────────────┘
Mobile: no sidebar, and #tabbar at the bottom (Home · Messages · Check · Log · Settings).
```

### Second-look prompt (360px, Night Mode sheet)

```
┌────────────────────────────┐
│  (dimmed chat behind)      │
│                            │
├────────────────────────────┤ ← light-coral top edge, 24px radius
│          ───               │ grip
│  (eye)                     │
│  Want a second look?       │ 32px
│  “heyy im fnie cna drive”  │ the user's message, quoted
│  This doesn't look like    │ 20px, #D6D0CB
│  how you usually text.     │
│  ┌ You said: take an Uber ┐│ the user's own plan, first
│  └────────────────────────┘│
│  Sending anyway in 45s ▬▬▬ │ aria-live countdown
│ ┌────────────────────────┐ │
│ │    Edit my message     │ │ 64px light-coral primary (thumb zone)
│ └────────────────────────┘ │
│ [ Send it anyway ]         │ 56px quiet secondary
└────────────────────────────┘
```

### Check-in (360px, Night Mode full screen)

```
┌────────────────────────────┐
│ [◉] SecondLook   [ 112 ]   │
│                            │
│  (eye ring)  28            │ big countdown, aria-live
│              seconds       │
│  Are you okay?             │ 32px
│  You didn't respond to…    │ 20px
│  ┌ Your plan ─────────────┐│
│  │ Take an Uber home      ││ plan first
│  │ “Don't drive, Alex.”   ││
│  └────────────────────────┘│
├────────────────────────────┤ hairline
│ ┌────────────────────────┐ │
│ │ Open Uber, like you    │ │ 64px light-coral primary
│ │ planned                │ │
│ └────────────────────────┘ │
│ [ I'm okay ] [ Prove it ]  │ 56px secondaries
└────────────────────────────┘
```

## 5. Hooks that move

None change. `#topnav` moves from inside the header bar into a sidebar column on desktop, with the same id, markup and `aria-current`. `#bar-cta` stays in the header.

## 6. Order of commits (after your OK)

1. Fonts and tokens
2. Shell (top bar, sidebar, tab bar)
3. Sober screens
4. Night screens
5. Landing
6. Contact and study pages
7. Extension
8. Icons, theme colours and `sw.js`
9. Tests, screenshots and before/after images
