# Devpost submission (copy each section into the form)

**Project name:** SecondLook
**Tagline:** The pause before a bad decision. It learns your sober self and steps in when you drift.
**Built with:** html, css, javascript, canvas, pwa, service-worker, ntfy, node.js

---

## Inspiration
Drunk driving isn't really an information problem. Everyone knows it's dangerous. The trouble is that alcohol damages the judgment you'd need to realise you're too drunk to drive, and that confidence is itself a symptom. Most apps stop at "you might be impaired", and the person who has to decide whether to listen is the impaired one. We wanted a plan that sober you makes and that still holds later in the night.

## What it does
SecondLook runs a two-minute sober baseline: reaction time, how steady your hand is while following a moving dot, and how you normally type. After that it keeps learning from messages you send on normal days.

Later on, before you send a text, it compares typing rhythm, corrections, long pauses and misspellings with your own baseline. If something looks off, it asks once: "This looks a little different from how you usually text. Want a second look?" You can edit the message, send it anyway, or take a one-minute check.

If you don't answer, or more messages get flagged, it checks in with a countdown. You can book a ride, text or call your safe contact, or pass a 15-second reaction check. If you agreed to it during setup and still don't respond, your safe contact gets an alert, and the app shows you exactly what was sent.

Everything goes into a transparency log. Safety settings lock for a few hours after a flag, so you can't switch them off at 2 a.m.

## How we built it
It's a plain HTML/CSS/JavaScript web app with no framework and no build step, so it runs from a single `index.html` and installs as a PWA. The reaction test uses `performance.now()` timings. The steady-hand task draws a Lissajous path on a canvas with pointer events, so it works with a mouse or a finger. The keystroke recorder listens to `input` events rather than `keydown`, which means it works with mobile keyboards, and it only stores timings, never the text.

Scoring uses per-feature z-scores against the user's own running statistics (Welford's algorithm), with floors that stop false alarms, and counts only drifts in the impaired direction. Optional instant alerts go through ntfy.sh, so the safe contact gets a real push notification with no backend. The scoring logic has Node unit tests, and every flow was tested end to end in a real browser.

## Challenges we ran into
- **Not being annoying.** Too many prompts and people uninstall; too few and it's useless. We compare you only with yourself, set floors on the variance, prompt once per message draft, and learn only from messages that look normal.
- **Consent vs. safety.** Stepping in when someone can't decide for themselves is the whole point, but it can't happen behind their back. We solved this with advance consent, a visible countdown that says what will happen, and a log of every action.
- **The web's limits.** Browsers can't send SMS silently, so we added ntfy push alerts and said plainly what the prototype can and can't do.

## Accomplishments that we're proud of
- The settings lock: a sober decision can't be quietly undone by an impaired one.
- The check-in survives a page reload and pauses fairly while you take the reaction check.
- Accessibility: it works with a keyboard, the pointer task can be skipped, it respects reduced motion, and it has no horizontal scroll on phones.
- It's honest. It never says you're "safe to drive", only that you look like your usual self.

## What we learned
Behaviour-change design matters as much as detection. How the prompt is worded ("want a second look?" rather than "you're drunk") decides whether anyone listens. We also learned how much keystroke timing reveals, and why that data should stay on the device.

## What's next for SecondLook
A keyboard extension so it works inside any messaging app, accelerometer-based steadiness checks, SMS alerts from a server, one-tap ride booking through ride-app APIs, and a small consented study to tune the thresholds.

---

## 2-minute demo video script
1. **(0:00)** Landing page: "People know drunk driving is dangerous. The problem is that being drunk breaks the judgment you'd need to notice."
2. **(0:15)** Setup: pick a safe contact and tick "alert them if I don't respond". Point out "I'm setting this up while sober".
3. **(0:30)** Baseline: show the green-tap test, the moving dot and the typing test for a few seconds each.
4. **(0:50)** Messages: type a normal text, and it sends. Then tap **Simulate an impaired message** and the second-look prompt appears. Open "What's different?".
5. **(1:10)** Don't respond. The check-in countdown appears, with a ride, text/call and the 15-second check.
6. **(1:30)** Let it run out. The alert to the safe contact appears, with SMS and WhatsApp buttons.
7. **(1:45)** Transparency log shows every step. Settings are locked, and you unlock them with a reaction check.
8. **(1:55)** "SecondLook: the pause before a bad decision."
