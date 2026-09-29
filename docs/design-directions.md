# Three directions for UI v2

All three keep the two modes (Sober Mode for planning, Night Mode for 2am), Atkinson Hyperlegible for body text, and the eye as the living status and countdown. They differ in how loudly the brand speaks and what the night out feels like. Every font is OFL-licensed and self-hosted as woff2, and contrast ratios are text against the mode's background and surface.

Previews (landing hero, second-look prompt and check-in only) are in `docs/directions/a.html`, `b.html` and `c.html`, with screenshots in `docs/directions/shots/`.

---

## A. Last bus home

**Concept:** getting home is a journey you plan in daylight. SecondLook is your timetable by day and the calm platform announcer at 2am.

The look is transit wayfinding: condensed signage type, route lines, a departure-board countdown. It's specific to "getting home", it's legible from across a room, and the countdown reads like a bus arrival time rather than a threat.

| Sober Mode "timetable" | Hex | Contrast (bg / surface) |
|---|---|---|
| platform paper | `#F3F4F6` | — |
| ink navy | `#0F1B33` | 15.6 / 17.1 |
| muted | `#4E5A70` | 6.3 / 7.0 |
| route green (primary buttons, white text 6.2) | `#0B6E55` | 5.7 / 6.2 |
| signal yellow: fill only, never text (ink on it 9.4) | `#F2B705` | — |

| Night Mode "platform at night" | Hex | Contrast |
|---|---|---|
| night blue (not black) | `#0E1726` | — |
| board surface | `#172339` | — |
| ink | `#F3F1EA` | 15.9 / 13.9 AAA |
| muted | `#B9C2D3` | 10.0 / 8.8 AAA |
| LED amber (the one action, ink on it 10.3) | `#FFB23E` | 10.0 / 8.8 AAA |
| arrival green (replies) | `#7FE0B4` | 11.3 / 9.9 AAA |

**Type:** Big Shoulders Display (Chicago's wayfinding face, condensed and tall) for headings and numerals, with Atkinson Hyperlegible for everything you read.

| Step | Sober | Night |
|---|---|---|
| body | 17 | 20 |
| lead | 20 | 24 |
| h2 | 28 | 32 |
| h1 | 44 / 64 desktop | 40 |
| numerals | 96 | 120 (departure board) |

**The eye:** it sits in a route roundel, the station marker at the end of a line that runs from a "you" dot to a "home" dot. At check-in the line drains towards home as the countdown runs out.

```
LANDING (mobile)            HOME                      PROMPT (sheet)            CHECK-IN
┌──────────────────┐       ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ◉ SecondLook     │       │ ◉  All quiet     │     │ ◉ Want a second  │     │ ◉ SecondLook 112 │
│ Getting home,    │       │ ●────────────◎   │     │   look?          │     │ CHECKING IN   28 │
│ planned sober.   │       │ you        home  │     │ “im fnie cna…”   │     │ ●─────●·······◎  │
│ [phone: msg →    │       │ [Going out?]     │     │ Your plan: Uber  │     │ Hey Alex.        │
│  prompt, eye]    │       │ [Ride] [Check]   │     │ ══ 20s ═══       │     │ Your plan: Uber  │
│ [Watch it happen]│       │ ▸ Tonight ▸ Net  │     │ [Edit my message]│     │ [Open Uber]      │
└──────────────────┘       └──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Risk check:** the night background is deep blue, not black, and it has two accents (LED amber and arrival green). There's no neon glow. Uppercase appears only on the departure-board numerals, never as eyebrow labels. The route line appears only where it means something (the journey home), not as decoration.

---

## B. Your sober self

**Concept:** the plan is a note from sober you to later-tonight you. The app is the one delivering it, in your own words, by moonlight.

It's the warmest and most human of the three: a soft optical serif for "your words" (headings, the plan, the note to self) and moon phases instead of a stopwatch.

| Sober Mode "sky" | Hex | Contrast |
|---|---|---|
| sky | `#E7EDF5` | — |
| paper | `#FFFFFF` | — |
| ink | `#1A1F2B` | 14.0 / 16.5 |
| muted | `#4A5366` | 6.6 / 7.7 |
| dusk (primary, white on it 8.3) | `#3544A8` | 7.0 / 8.3 |
| rose (the note-to-self voice) | `#9C3D54` | 5.6 / 6.5 |

| Night Mode "moonlight" | Hex | Contrast |
|---|---|---|
| plum night | `#1A1424` | — |
| raised | `#251D33` | — |
| moon ink | `#F3ECDD` | 15.3 / 13.7 AAA |
| muted | `#CBBFD6` | 10.2 / 9.2 AAA |
| lamp (the one action, ink on it 10.8) | `#FFBF66` | 11.0 / 9.9 AAA |
| reply green | `#9BE3BE` | 12.1 / 10.8 AAA |

**Type:** Fraunces, a soft, variable optical serif, for headings and anything the user wrote, with Atkinson Hyperlegible for body and all buttons.

| Step | Sober | Night |
|---|---|---|
| body | 17 | 20 |
| lead | 21 | 24 |
| h2 | 26 | 30 |
| h1 | 40 / 60 | 36 |
| note to self | 24 italic | 28 italic |

**The eye:** the iris becomes the moon. By day it's full and open. At check-in, the earth's shadow sweeps across it as the countdown runs: a slow eclipse, not a ticking clock.

```
LANDING                     HOME                      PROMPT                    CHECK-IN
┌──────────────────┐       ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ A note from your │       │  ( ◉ full moon ) │     │ ◐ Want a second  │     │      ( ◑ )       │
│ sober self.      │       │ All quiet.       │     │   look?          │     │   28 seconds     │
│ [phone with the  │       │ [Going out?]     │     │ “Don't drive,    │     │ Hey Alex.        │
│  note arriving]  │       │ [Ride] [Check]   │     │   Alex.” — you   │     │ “Don't drive…”   │
│ [See it happen]  │       │ ▸ details        │     │ [Edit my message]│     │ [Open Uber]      │
└──────────────────┘       └──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Risk check:** it has a serif, but on cool sky and plum, not cream, and the accent is dusk blue and lamp, not terracotta. That's the one trap it had to steer around, and it does. No gradients: the moon is flat shapes.

---

## C. Crosswalk (the bold risk)

**Concept:** stop, look, then cross. SecondLook is a crossing signal for the night, with full-bleed colour, enormous type, and zebra stripes that disappear as the countdown runs.

It's the loudest direction by far. Sober Mode fills the screen with signal yellow and black ink, so it would be impossible to miss in a Devpost gallery. Night Mode is asphalt grey with painted white stripes, and the one action is yellow.

| Sober Mode "signal" | Hex | Contrast |
|---|---|---|
| signal yellow (full-bleed background) | `#FFD23F` | — |
| white panels | `#FFFFFF` | — |
| ink | `#121212` | 13.0 / 18.7 |
| muted (on yellow) | `#3A3320` | 8.7 / 12.5 |
| crossing blue (links) | `#1446A0` | 6.0 / 8.7 |

| Night Mode "asphalt" | Hex | Contrast |
|---|---|---|
| asphalt (mid-dark, not black) | `#1F232B` | — |
| raised | `#2A2F39` | — |
| paint white | `#F5F5F0` | 14.4 / 12.3 AAA |
| muted | `#C3C9D3` | 9.5 / 8.1 AAA |
| signal yellow (the one action, ink on it 13.0) | `#FFD23F` | 10.9 / 9.3 AAA |
| walk green (replies) | `#7CEBAA` | 10.7 / 9.2 AAA |

**Type:** Unbounded, a wide geometric variable face at display sizes only (headlines, numerals), with Atkinson Hyperlegible for everything else.

| Step | Sober | Night |
|---|---|---|
| body | 18 | 20 |
| lead | 22 | 24 |
| h2 | 30 | 30 |
| h1 | 48 / 88 | 40 |
| numerals | 120 | 140 |

**The eye:** drawn big with a thick black stroke, like road paint. At check-in it sits above a zebra crossing, and one stripe disappears per tick of the countdown. The lid lowers as the status gets worse.

```
LANDING                     HOME                      PROMPT                    CHECK-IN
┌──────────────────┐       ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│█ yellow █████████│       │█ yellow █████████│     │ asphalt sheet    │     │ asphalt       112│
│ STOP.            │       │   ( ◉ ) big      │     │  ( ◉ )           │     │    ( ◉ )         │
│ LOOK.            │       │ All quiet.       │     │ Want a second    │     │ ▮▮▮▮▮▮▯▯▯▯  28   │
│ THEN SEND.       │       │ [Going out?]     │     │ look?            │     │ Hey Alex.        │
│ [phone demo]     │       │ [Ride] [Check]   │     │ [Edit my message]│     │ [Open Uber]      │
│ [Try it now]     │       │ ▸ details        │     │                  │     │                  │
└──────────────────┘       └──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Risk check:** the full-bleed yellow is the risk. It's loud, and a judge will remember it. At night we don't go near-black with neon: asphalt is mid-dark grey, and the accent pair is paint white plus signal yellow. The yellow backgrounds stay in Sober Mode only, never at 2am. The big type is sentence case except the three-word "Stop. Look. Then send." hero, which is a sequence and is meant to be shouted.

---

## Review against generic AI-looking defaults

| Default | A | B | C |
|---|---|---|---|
| Near-black with one neon accent | Deep blue night, two accents | Plum night, lamp and green | Asphalt grey, white stripes and yellow |
| Cream, serif, terracotta | — | Serif, but sky/plum with dusk/lamp | — |
| Identical rounded cards with grey shadow | Route lines and board panels, no shadow | Paper notes only for the user's words | Flat colour fields, no cards |
| Gradient washes | none | none | none |
| ALL-CAPS eyebrows | none (caps only on board numerals) | none | none |
| "A · B · C" meta strings | none | none | none |
| → on every button | none | none | none |
| 01/02/03 on non-sequences | none | none | only "Stop. Look. Then send.", a real sequence |
| Fade-slide-up everywhere | one moment: the route drains | one moment: the eclipse | one moment: the stripes disappear |
