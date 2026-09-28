# Design audit (before the redesign)

Screens were captured at 360, 768 and 1280 px in empty and filled states, using demo mode to reach the prompt, check-in and alert. The "before" shots are in `docs/screenshots/before/`.

The short version: everything works, and nothing looks like it was designed for the moment it's used in. The whole app wears one skin, navy background with a mint accent, which is the most common "AI dark UI" default. The screen you see at 2am in a bar looks the same as the one you fill in at your desk on a Tuesday. That's the biggest problem, and the rest follows from it.

## Across every screen

- The palette is near-black navy with one neon mint accent, used for links, primary buttons, the logo and "ok" states alike. Primary, success and brand colours are the same colour, so nothing stands out.
- Every block is the same rounded card with the same 1px border. Home is 7 of them in a row, settings has 7, and the log is one card per line. That's card soup: no hierarchy, just stacking.
- Emoji do the job of icons (🚗 💬 📞 ✅ 🆘 🌙 🧪 📍). They render differently on every OS, the tab bar emoji are desaturated with a grayscale filter, and they look cheap next to the text.
- System font only. Headings and body use the same face, and there's no type scale beyond a few ad-hoc sizes.
- There are ALL-CAPS eyebrow labels over most headings ("LATE NIGHT", "STEP 1 OF 2 · DO THIS WHILE YOU'RE SOBER", "QUICK CHECK RESULT"), and "A · B · C" meta strings everywhere.
- The toast sits at the bottom centre and covers content, including form fields in settings and the log's last item.
- The desktop bottom tab bar is a full-width strip with centred emoji, a phone pattern stretched to a desktop.

## Landing

- The hero is a big headline plus two buttons, which is generic. The product's most distinctive moment, a message being paused and asked about, never appears on the page.
- The three NHTSA stats sit in three equal boxes with small grey captions. They read like a dashboard, not a reason to care.
- "How it works" is four identical cards with 1–4 badges, and "Built on consent" is a long checklist. The strongest idea (you set the rules while sober) is buried in a bullet.
- At 1280 the content is a narrow 760px column, with lots of empty dark space on each side.

## Setup

- It's one long form: 5 fields and 4 checkboxes on a 360px screen add up to about 1,600px of scrolling before the only button.
- "Step 1 of 2" is an all-caps eyebrow, and step 2 (the baseline) isn't visibly connected to it.
- The consent statements, the heart of the product, look like terms-of-service checkboxes.
- The error message appears above the submit button, far from the field that caused it.

## Baseline tasks

- The progress list is three thin lines with small labels, easy to miss.
- The instructions are one grey sentence. The reaction pad is a huge dark block with little guidance about what "wait for green" means before you start.

## Home dashboard

- There's no hero. "Hi Alex" is the biggest thing on the page, and the actual status ("All quiet") is a 20px heading in a small card with a tiny dot.
- The demo card is the largest element on the page and pushes everything else down.
- The three action tiles repeat the tab bar (Messages, Check), and on desktop they sit under the floating tab bar.
- The safety net table, baseline numbers and "Tonight" are always expanded. They're useful once a week and shown every time.
- When things are bad ("Please don't drive tonight"), the page looks almost the same as when they're fine; only the dot and border change colour.

## Messages

- It's a plain list of bubbles in a card-less column, with no sense of a real chat app (no header weight, no day marker, a small composer).
- "Simulate an impaired message" is a link floating between the log and the composer.

## Second-look prompt

- It's a centred modal on desktop and a bottom modal on mobile, with the same styling as every other dialog.
- There are three stacked buttons of similar weight plus a countdown bar, and with Night Out on, a plan card and an "Open Uber" button as well. That's 5 actions in one dialog for someone who may be impaired.
- The countdown is a 4px yellow line with 12px grey text. It's easy to miss.

## Check-in and alert (worst offender)

- At 360px, the countdown, heading, reason, plan card, consent box and 4–5 buttons don't fit. The ride button is below the fold and the 112 button is far below it, so the thumb zone holds the plan card, not the main action.
- The overlay is 97% opaque, and the dashboard text shows through behind the ring.
- The heading wraps with an orphaned emoji ("checking in / 💙").
- The alert screen shows a 5-line paragraph and 5 buttons of near-equal weight. "I'm safe, close" looks the same as "Send alert by SMS".
- The type is the same size as on the sober screens (16px body). Nothing about it is designed for 2am.

## Quick check

- The intro is fine but plain. The result gauge is a generic donut chart. The bars are thin, and the "usual → now" text wraps awkwardly at 360px.

## Log

- It's a flat list of identical cards with emoji icons, with no grouping. A week of use becomes an undifferentiated wall.
- There are three equal buttons (Download, Import, Clear), and Clear looks as safe as Download.
- "Your data" is another checklist card at the bottom.

## Settings

- Seven stacked cards and about 2,400px of scroll at 768px, with no grouping or navigation.
- The locked state is one card at the top. The disabled fields below just look greyed out, with no lock indicator where you're actually looking.
- The toast covered the sensitivity dropdown in the capture.

## Night Out form and reminder

- The form is a modal with radio "cards" styled like the consent checkboxes, a time input and a textarea. It works but has no personality, for the one screen where the user writes something personal.
- The reminder reuses the prompt dialog, so it's hard to tell apart from a second-look prompt.

## Contact view, study, extension

- The contact view uses the same navy card stack. For a contact woken at 2am by a notification, the alert is a card among cards.
- The study page is a long form of the same cards.
- The extension popup and overlay each carry their own hard-coded colours that only roughly match the app.

## Accessibility (measured)

- Contrast passes AA after the last fix, but nothing reaches AAA, which matters for Night Mode.
- Touch targets are 44px. That's the minimum, and too small for impaired, one-handed use.
- Focus rings and keyboard support are fine. Countdowns now announce at 30, 10 and 5 seconds.
