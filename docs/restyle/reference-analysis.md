# Reference analysis

Three reference screenshots, saved in `docs/reference/`:

| File | What it shows |
|---|---|
| `ref-1-hero-upload.png` | App shell (top bar + left sidebar), centred hero, big white tool card with a dashed upload zone, form row with a primary button |
| `ref-2-feature-split.png` | Section intro (pill label, centred headline, paragraph), then a two-column feature row: illustration card left, pill + headline + text right |
| `ref-3-testimonials.png` | Centred headline over a 3-column grid of white cards (stars, quote, avatar circle, name, role) |

There is no `docs/reference/notes.md`, so everything below is read from the images. We take the design language only: no logo, name, illustration, copy or reviews are copied.

## Colour

Hex values are sampled from the screenshots.

| Role | Hex | Where it appears |
|---|---|---|
| Page canvas | `#FFFDF9` | Main background: a warm off-white, the most common colour in refs 1 and 2 |
| Card | `#FFFFFF` | Tool card, testimonial cards, sidebar tiles |
| Soft alt surface | `#FAFAF9` / `#F6F5F4` | Around cards in ref 3, icon tiles in the sidebar |
| Coral accent | `#FF6B4A` | Logo tile, upload circle, primary button, sign-in button |
| Coral tint | `#FFF5F3` / `#FFEFEC` | Active nav item, pill backgrounds, upload zone fill, hero glow |
| Deep coral (text) | `#B93F25` | Pill label text ("Translation that still feels yours") |
| Warm coral (avatars) | `#FF8A73` | Initial circles on testimonials |
| Amber | `#F59E0B` | Star ratings |
| Ink | `#2C2C2C` / `#3D3A37` | Headlines / body text (warm charcoal, not pure black) |
| Muted ink | `#817F7D` | Secondary text, input text |
| Error/notice red | `#C5554D` | "This tool costs…" note |
| Hairlines | about `#EEEAE6` | Card borders, sidebar divider, header bottom border |
| Glow | coral → lilac radial gradient, very faint | Behind the hero headline |

**Contrast problem:** white text on `#FF6B4A` is only **2.8:1**, which fails WCAG AA. The reference's own primary button fails. SecondLook keeps `#FF6B4A` for decoration (logo tile, icon circles, glows) and uses a deeper coral, `#C63D1F` (5.1:1 with white), for buttons and links. In Night Mode it flips to a light coral with dark text for AAA.

## Typography

- **Style:** a geometric sans with round bowls, a single-storey "g" and fairly tight headline tracking. Headlines are 600–700 weight, set close (about −0.03em), in warm charcoal. Body copy is lighter (400) at a comfortable size in muted grey.
- **Scale seen (at 1631px wide):** hero headline about 72px; section headline about 48px; feature headline about 44px; lead paragraph about 22px with line-height 1.6; nav and body about 17px; small labels 14–15px; pill labels 15px/600.
- **Free match:** the reference font isn't identified. The closest free (OFL) geometric match is **Outfit**, which I'll self-host. **Atkinson Hyperlegible** stays for Night Mode body text, because legibility at 2am wins over matching the reference.

## Layout and grid

- An app shell: top bar about 88px high with the logo left and CTA right, a hairline under it, and a **left sidebar about 300px wide** with a vertical nav. The main column is centred with a max width of about 1150px.
- The hero is centred: headline, lead text, then one big card.
- The feature row is a 2-column split (roughly 55/45) with the image card on one side and text on the other.
- The testimonials are a 3-column card grid with about 20px gaps.

## Spacing, radius, borders, shadows

- **Spacing rhythm:** about 8px base. Card padding about 36px; gaps between sections are large (about 96px+); nav items are about 66px apart.
- **Corner radius:**

  | Element | Radius |
  |---|---|
  | Big cards | about 24px |
  | Upload zone | about 16px |
  | Buttons and inputs | about 12px |
  | Nav active pill | about 14px |
  | Icon tiles | about 10px |
  | Pills and avatars | fully round |

- **Borders:** 1px warm hairlines on cards. The dashed upload border is coral at low opacity.
- **Shadows:** almost none on cards. The primary button has a soft coral shadow (about `0 8px 20px rgba(255,107,74,.25)`).

## Icons

Thin outline icons (about 1.75px stroke, rounded caps), 20px, each sitting in a **light rounded-square tile** (`#F6F5F4`) in the sidebar. The active item's tile turns white on a coral-tint row. SecondLook's own icon set already has this stroke style; only the tiles change.

## Buttons and inputs

- **Primary:** coral fill, white bold text, radius about 12px, tall (about 56px), soft coral shadow.
- **Header CTA:** the same, smaller.
- **Select input:** white, 1px hairline, radius about 12px, 56px tall.
- **Dropzone:** a dashed coral border on a coral-tint fill, with a round coral icon button in the centre.

## How hierarchy is created

Size and weight do most of the work, with very little colour. Coral appears on only one or two elements per screen (the primary action and the active nav). Pills in coral tint label each section before its headline. Muted grey pushes body copy back.

## Motion (inferred)

The screenshots are static. The soft glow and rounded cards suggest gentle fades and lifts: a hover lift on cards and a colour shift on buttons. Nothing bouncy.

## What maps to which part of SecondLook

| SecondLook part | Reference to follow |
|---|---|
| Landing | ref 1 hero (centred headline + big card holding the phone demo); ref 2 split rows for "how it works" and the two modes; ref 3 card grid for the promises (**not** as fake reviews) |
| App shell (Sober Mode, desktop) | ref 1: top bar + left sidebar with icon tiles and a coral-tint active row. On mobile the sidebar becomes the existing bottom tab bar. |
| `#/home` dashboard | ref 1 tool card for the status card; ref 3 card grid for the action cards |
| Setup / settings | ref 1 form row (white card, 56px inputs, coral primary) |
| Log | ref 3 white cards, one per night |
| Messages (chat) | ref 1 card and input styles |
| Second-look prompt, check-in, alert, reminders | Adapted: warm dark version of the same shapes. The Night Mode rules win (one primary action, 64px+ primary buttons at the bottom, 18px+ body, AAA contrast). |
| Contact page | Night Mode adaptation |
| Study page | Sober Mode, same as setup |
| Extension popup / overlay | Popup like the Sober cards; overlay like the Night Mode sheet |

## What we won't use

- **Customer testimonials with star ratings:** SecondLook has no real reviews, and publishing invented ones would be fake. We use the card grid pattern for the promises instead.
- **Their illustrations and 3D avatars:** they belong to their brand. SecondLook keeps its eye logo, the phone demo and the sonar background (recoloured).
- **Coral with white text at `#FF6B4A`:** it fails contrast (2.8:1). We use the deeper `#C63D1F` instead (5.1:1).
- **Muted text at `#817F7D`:** only 3.9:1 on the canvas. We use `#6B6865` instead (5.5:1).
- **"Sign in with Google":** SecondLook has no accounts.
