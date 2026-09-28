# Devpost submission

Paste each section into the matching Devpost field.

**Project name:** SecondLook
**Tagline:** The pause before a bad decision. It learns your sober self and steps in when you drift.
**Built with:** javascript, html5, css3, web-crypto, chrome-extension, manifest-v3, ntfy, service-worker, pwa, node.js, playwright

---

## Inspiration

Drunk driving isn't an information problem. Everyone knows it's dangerous. The trouble is that alcohol damages the judgment you'd need to notice you're too drunk to drive, and feeling fine is one of the symptoms. Most apps stop at "you might be impaired", which hands the decision back to the one person who can't make it well tonight.

So we asked a different question. What if the sober you, earlier in the day, could make the decision instead, and the app just kept that promise?

## What it does

SecondLook starts with a 2-minute sober baseline: how fast you react, how steady your hand is when following a moving dot, and how you normally type. Every later reading is compared with you, never with other people.

Later in the night, a browser extension watches for drift on WhatsApp Web, Instagram DMs and Gmail. It looks at slower and more uneven typing, more corrections, long pauses and misspellings. When a message looks unlike you, it holds it and asks: "This looks a little different from how you usually text. Want a second look?" You can edit it, send it anyway (it really sends), or take a one-minute check.

If you don't answer, the SecondLook app opens a check-in with a countdown. It offers a ride home, a text or call to your safe contact, a 15-second reaction test to show you're fine, and a confirmed 112 call. If the countdown runs out and you agreed to this while sober, your contact's phone gets a real notification. They open a small page, tap "I'm on my way", and that answer shows up as a banner on your screen.

Night Out mode lets you commit before you leave: "I'm taking an Uber, home by 1:30, don't drive, Prashant, seriously." Later, every prompt shows your own plan first, with one tap to open Uber and your home already filled in. Nothing happens behind your back. Every step goes into a transparency log in plain English, and safety settings lock for 6 hours after a flag so a drunk you can't quietly switch off the sober plan.

## How we built it

It's plain HTML, CSS and JavaScript with no framework and no build step, so it runs from `index.html` or GitHub Pages and installs as a PWA. The scoring is a set of pure functions: per-signal z-scores against running statistics (Welford's algorithm), floors so a thin baseline can't cause false alarms, and only the impaired direction counts.

The extension is Manifest V3. It uses capture-phase listeners that record keystroke timing only and read the text once, in memory, at send time. The prompt lives in a closed Shadow DOM so the site's CSS can't touch it. Every site selector sits in one config file with fallbacks, and everything fails open: if our code throws, your message sends.

Alerts are end-to-end encrypted with Web Crypto AES-GCM. The key rides in the URL fragment of the link you share with your contact, which browsers never send to a server, so the ntfy.sh relay only ever sees ciphertext and a generic "may need help" notification. We also wrote a small QR encoder so the link can be shared without any CDN, and checked its output with an independent decoder.

We have 38 unit tests, and we ran every flow in Edge with Playwright. That included the real extension on mock WhatsApp and Gmail pages served at their real URLs, and two browsers talking through the live ntfy.sh.

## Challenges we ran into

The hardest part was not being annoying. Too many prompts and people turn it off. Our dictionary was flagging normal work emails ("team", "report", "attached") as misspellings, so we grew it to about 2,500 words and we compare the misspelling rate with your own usual rate.

Consent and safety pull against each other. Stepping in when someone can't decide is the point, but doing it behind their back would be surveillance. Advance consent, a visible countdown that says exactly what happens next, and a log of every action got us there.

The web has limits. Browsers can't send SMS by themselves and they throttle background tabs. We used ntfy for real notifications and said plainly in the UI where the limits are. Uber's current deep-link format needs coordinates, so instead of geocoding through a server we let you save your home location on your own device.

## Accomplishments that we're proud of

- The loop works for real: a message caught in WhatsApp Web ends with a notification on the contact's phone and their "on my way" on your screen, and ntfy never sees what happened.
- The settings lock means an impaired you can't quietly undo what the sober you decided.
- It never says "you're safe to drive". A normal result says you look like your usual self, and that a ride is still the safer choice if you've been drinking.
- It's usable with only a keyboard, meets WCAG AA contrast, and has no sideways scrolling at 360px.

## What we learned

The wording of a prompt decides whether anyone listens. "Want a second look?" gets a different reaction from "You seem drunk." We also learned how much keystroke timing reveals, which is why none of it leaves the device, and that a web page can do real end-to-end encryption with nothing but Web Crypto and a URL fragment.

## Evidence

*(Fill in after the study. These are placeholders, never taken from synthetic data.)*

We ran a small study with [N] people using safe stand-ins for impairment, never alcohol: typing with the non-dominant hand, counting backwards by 7 out loud during the tasks, and an optional tired round. On a sober retest, SecondLook raised a false alarm [__]% of the time at the default threshold. It flagged [__]% of non-dominant-hand rounds and [__]% of dual-task rounds. Stand-ins aren't intoxication, so this shows the scoring reacts to disturbed motor control and attention; it doesn't prove it detects alcohol. A real product would need a clinical study.

## What's next for SecondLook

A keyboard for Android and iOS so it works in every messaging app, steadiness from the phone's motion sensors, SMS alerts from a small server for contacts who won't install ntfy, one-tap booking through ride-app APIs, and a proper consented study.

---

## Demo video script (1:55)

Setup before recording: host the app on GitHub Pages and load the demo profile (user Alex, contact Priya). In Settings, add a home address and tap "I'm at home, save this location" so Uber opens with home filled in. Export the extension code and import it into the extension, then open WhatsApp Web. On your phone, open the contact link once and subscribe to the topic in the ntfy app. Use a split screen in the edit for 0:55–1:25.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:10 | Landing page | "Drunk driving happens because being drunk breaks the judgment you'd need to notice you're too drunk to drive." |
| 0:10–0:22 | Setup screen, then the Night Out form: Uber, home by 1:30, note "Don't drive, Alex. Seriously." | "So with SecondLook you decide while you're sober: who your safe contact is, and how you're getting home tonight." |
| 0:22–0:40 | WhatsApp Web. Type a sloppy message slowly with corrections, press Enter. The prompt appears. | "Later, the extension notices my typing doesn't look like me and asks once: want a second look?" |
| 0:40–0:48 | Don't answer. Jump-cut to the new tab with the check-in countdown. | "I ignore it, so SecondLook checks in with me directly. It offers a ride, my contact, or a 15-second test." |
| 0:48–0:55 | Countdown hits zero: "We let Priya know". | "No answer, and I agreed to this while sober, so my contact is told." |
| 0:55–1:10 | Split screen: the phone gets the ntfy notification, then tap → contact page "Alex may need help". | "Her phone gets a real notification. The details are end-to-end encrypted; the relay never sees them." |
| 1:10–1:25 | Contact taps "I'm on my way". Laptop banner: "Priya is on the way – 1:12 AM". Tap "Thanks, I'm staying put". | "She taps on my way, and it shows up on my screen right away." |
| 1:25–1:42 | Home screen: Night Out reminder with "You planned to take an Uber home. Here it is →", tap Open Uber. | "And instead of a lecture, it shows me my own plan, one tap to an Uber with home already filled in." |
| 1:42–1:55 | Transparency log, then logo. | "Every step is in a log I can read. Nothing happens behind my back. SecondLook: the pause before a bad decision." |
