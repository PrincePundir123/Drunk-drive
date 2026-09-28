# SecondLook

The pause before a bad decision.

People don't drive drunk because nobody told them it's dangerous. They do it because alcohol breaks the judgment they'd need to notice they're too drunk to drive, and the confidence they feel is itself a symptom. An app that says "you might be impaired" and walks away leaves the decision with the one person who can't make it well.

SecondLook works differently. While you're sober, you write the rules: who your safe contact is, what should happen if you don't answer, how you're getting home tonight. Later in the night it compares your typing with your own sober baseline. When something looks off, it asks once ("This looks a little different from how you usually text, want a second look?"). If you don't answer, it checks in, offers a ride, and only if you agreed in advance, lets your safe contact know. Every step is written to a log you can read.

Built for Beginner's Paradise: FirstCommit.

## Try it in two minutes

Open `index.html` in Chrome or Edge and click **Try the 2-minute demo**. Then:

1. On the home screen, click **Open contact view (2nd window)** and put the two windows side by side. The second one is what the safe contact sees on their phone.
2. Go to **Messages** and tap **Simulate an impaired message**.
3. Don't answer the prompt. After 20 seconds the check-in starts, and after 30 more the alert goes to the contact window through ntfy.sh, end-to-end encrypted.
4. In the contact window, tap **I'm on my way**. A banner appears on the user's screen.
5. Open **Log** to see every step in plain English.

The demo also has a pre-filled Night Out plan (an Uber home, a note to self), so the prompts show the plan first.

To run it locally with location and offline mode working:

```bash
npm start        # http://localhost:5173 (Node 18+, no dependencies)
npm test         # 38 unit tests
```

To publish it, push to GitHub and turn on **Settings → Pages → Deploy from branch → main / (root)**. Everything is static, so there's no build step.

## What's in it

The web app is the core: setup while sober, a 2-minute baseline (reaction time, a steady-hand tracking task, typing rhythm), the second-look prompt in a practice chat, the check-in with a countdown, the transparency log, and a quick 1-minute check. Safety settings lock for 6 hours after anything is flagged, and a 15-second reaction test unlocks them, so a drunk you can't quietly undo what a sober you decided.

The browser extension brings the prompt to WhatsApp Web, Instagram DMs and Gmail. It catches Enter (Ctrl+Enter in Gmail) and the send button, holds a message that looks unlike you, and shows the prompt in a closed Shadow DOM. **Send anyway** really sends by clicking the site's own send button. If you ignore the prompt, it opens the web app's check-in in a new tab. If anything inside the extension fails, the message sends normally.

The contact view (`contact.html`) closes the loop. Your safe contact gets a real phone notification through the free ntfy app, opens the page, and can answer "I'm calling now", "I'm on my way" or "Can't come, book them a cab". Their answer shows up as a banner on your check-in screen, and you can reply "Thanks, I'm staying put".

Night Out mode is a commitment device. Before going out you note how you're getting home (cab, a friend, walking or staying over), when you'll be home, and optionally a note to later-tonight you. While it's on, sensitivity goes up one level, check-in reminders arrive every 90 minutes by default, and every prompt shows your own plan first ("You planned to take an Uber home. Here it is →") with one tap to open it. A missed reminder counts like an ignored prompt. If you haven't tapped **Home safe** 30 minutes after your home-by time, the check-in starts.

Rides and emergencies share one module (`js/rides.js`). Uber opens with home filled in when you've saved your home location. Ola, Rapido and Lyft open with your address copied to the clipboard. **Call 112** is on the check-in screen and the contact view, behind a confirm step with Cancel focused by default.

The validation study (`study.html`, not linked from the app) measures the false-alarm rate with safe stand-ins for impairment. There's more on that under Evidence below.

## Architecture

```
 user's browser                                         contact's phone
 ┌────────────────────────────┐                        ┌──────────────────────┐
 │ web app (index.html)       │                        │ ntfy app             │
 │  baseline · prompt ·       │  generic notification  │  "Alex may need help │
 │  check-in · Night Out · log│ ─────────────────────▶ │   – tap to open"     │
 │                            │                        └─────────┬────────────┘
 │  AES-GCM encrypt (Web      │  ciphertext  ┌────────┐          │ opens
 │  Crypto, key never leaves  │ ───────────▶ │ntfy.sh │ ───────▶ ▼
 │  the devices)              │ ◀─────────── │ relay  │ ◀─────── contact.html
 └──────────▲─────────────────┘  ciphertext  └────────┘  decrypts, replies
            │ #/home?checkin=ext-…
 ┌──────────┴─────────────────┐
 │ extension (WhatsApp Web,   │   timing-only recorder, prompt in closed shadow DOM,
 │ Instagram DMs, Gmail)      │   chrome.storage; baseline imported as a code
 └────────────────────────────┘
```

There's no backend and no account. ntfy.sh is the only network service, and it's only used after you set up the contact link or opt in to phone reminders.

When you set up the contact link, the app generates two random 128-bit topics (base32) and a 256-bit AES-GCM key. The link you share looks like `contact.html?a=<alertTopic>&r=<replyTopic>#k=<key>`. Browsers never send the `#fragment` to a server, so the key goes from your phone to your contact's phone and nowhere else. Opening the link once saves the key on the contact's device and strips it from the address bar. Alert details go, encrypted, to `<alertTopic>-d`. The alert topic itself only receives the generic "may need help – tap to open" notification, whose link carries no key. Replies come back encrypted on the reply topic.

## Privacy model

Message text is never stored or sent. The recorder keeps keystroke timing and counts only. When you press send, the text is read once, in memory, to count misspelled words, and then it's gone. The practice chat lives in memory and disappears on reload.

Your baseline, settings and log stay in your browser's localStorage (the extension uses chrome.storage). The extension gets your baseline as a code you paste in; it contains numbers and settings, never words.

Alerts leave your device only if you agreed during setup. What leaves is ciphertext plus a generic notification with your first name. Location and home address go only inside the encrypted alert, and only if you ticked that box.

The study exports numbers only and uses codes like P07 instead of names.

## Misuse and threat model

Could someone use SecondLook to spy on a partner? It's built so that doesn't work. Everything runs on the user's own device, and there's no dashboard for anyone else. The contact receives nothing until an alert fires, and alerts fire only under rules the user chose. Even then the contact gets a notification and a reason in general terms, never messages or typing data. Location is shared only if the user opted in. The check-in, the alert text and the log are all visible to the user, so nothing happens behind their back.

A few other cases:

- Someone who learns a topic name can't read anything, because everything on the topics is encrypted. They can post junk, and both sides reject it with a clear warning.
- ntfy.sh sees topic names, timing, and the generic notification with a first name. It never sees the reason, location or replies.
- The user, while impaired, trying to switch it off: settings, pausing the extension and replacing the baseline are locked for 6 hours after a flag. Clearing browser data still works. The lock is there to slow you down, not to trap you.
- A lost phone: the key lives in the contact link. Resetting the link in Settings makes new keys and cuts off the old ones.

## Evidence

> Fill this in after running the study (see [`results/README.md`](results/README.md)). Until then, these are placeholders. No numbers here come from synthetic data.

We tested SecondLook with [N] people using safe stand-ins for impairment. No alcohol was involved.

| Measure | Quick check | Message |
|---|---:|---:|
| False alarms on a sober retest (threshold 40) | [__]% (95% CI [__]–[__]%) | [__]% |
| False alarms on a sober retest (threshold 65) | [__]% | [__]% |
| Flagged: non-dominant hand (40) | [__]% | [__]% |
| Flagged: dual task, counting backwards (40) | [__]% | [__]% |
| Flagged: tired or late night, self-reported (40) | [__]% (n=[__]) | [__]% |

Signals that separated conditions best: [signal] (AUC [__]), [signal] (AUC [__]). The full report is in `results/summary.md` and the chart is in `results/chart.svg`.

Stand-ins are not intoxication. They show the scoring reacts to disturbed motor control and attention. They don't show it detects alcohol. The sample is small, and every round happens on the same day and device as the baseline. A real product would need a proper clinical study.

## Install the browser extension

1. Open the web app over http(s) (`npm start` or your GitHub Pages link), then finish setup and the baseline.
2. In **Settings → Use it in WhatsApp, Instagram & Gmail**, click **Show my extension code** and copy it.
3. Go to `chrome://extensions` (or `edge://extensions`), turn on Developer mode, click **Load unpacked** and pick the `extension/` folder.
4. Click the SecondLook icon, paste the code and press **Import**.
5. Reload any open WhatsApp Web, Instagram or Gmail tabs.

On any other site, open the popup and tick **Also use on <site>**. It asks permission for that one site; the extension never gets `<all_urls>`. To keep one complete record, use **Copy log for the web app** in the popup, then **Log → Import extension log** in the web app.

WhatsApp and Instagram change their markup often. Every selector lives in [`extension/src/selectors.js`](extension/src/selectors.js), with fallbacks, so that's the one file to edit when a site changes. The shared logic isn't duplicated: `npm run build:ext` copies `metrics.js`, `words.js`, `share.js` and `rides.js` into `extension/lib/`, and `npm test` fails if those copies are stale.

A full product would be a mobile keyboard (an Android IME or an iOS keyboard extension), since that's where people text late at night. The extension is the closest honest version we can build and demo on the web.

## How the scoring works

Each signal is compared with your own baseline, never with other people:

```
z = (now − your usual) / max(your usual spread, % floor, minimum floor)
score = 100 × (1 − e^(−(0.6 × weighted average z + 0.4 × max z) / 2))
```

Only drifts in the impaired direction count, so typing faster than usual never counts against you. The floors stop a thin baseline from causing false alarms. Scores of 0 to 39 look like you, 40 to 64 are a bit different, and 65 or more are very different. The prompt appears at 55 by default (45 on protective, 65 on gentle), and Night Out raises sensitivity one level. The baseline keeps learning from messages that look normal, but never within 6 hours of a flag.

The signals are reaction time, tracking error on the moving dot, time between keys, rhythm variability, corrections, long pauses, typos in the typing test, and misspelled words in messages.

## Project structure

```
index.html, css/style.css   web app shell and styles
js/app.js                   views, prompt, check-in, alerts, Night Out, log, settings, demo
js/metrics.js               scoring (pure functions, also used by the tests)
js/tests.js                 reaction, steady-hand and typing tasks; keystroke recorder
js/words.js                 dictionary (~2,500 everyday words, texting slang, Hinglish)
js/rides.js                 ride, call, message and 112 links (shared everywhere)
js/secure.js, js/relay.js   AES-GCM encryption; ntfy publish and subscribe
js/qr.js                    local QR encoder for sharing the contact link
js/nightout.js              Night Out logic
js/share.js                 baseline and log codes between web app and extension
contact.html, js/contact.js the safe contact's page
study.html, js/study.js     validation study (stand-ins, no alcohol)
extension/                  Chrome/Edge extension (MV3)
scripts/                    dev server, extension sync, icon generator, study analysis
results/                    study results go here (see results/README.md)
tests/                      node:test unit tests
```

## Testing

`npm test` runs 38 unit tests covering scoring, keystroke analysis, the dictionary, encryption, contact links, the QR encoder, the extension codec and packaging, Night Out logic, ride links and the study analysis math. The QR codes were also checked with an independent decoder (jsQR) across versions 2 to 39.

Every flow was also run end to end in Microsoft Edge with Playwright: setup, baseline, prompt, check-in and alert; the real unpacked extension on mock WhatsApp Web and Gmail pages served at their real URLs; two browsers talking through the live ntfy.sh; Night Out; rides and 112; the study; and a keyboard-only walkthrough at 360px width. Every text colour meets WCAG AA contrast. The browser tests aren't in the repo because they need Playwright.

## Limitations

- These are behavioural signals, not a breathalyzer. Tiredness, stress or a new keyboard can look similar, which is why SecondLook asks and suggests instead of blocking.
- Browsers can't send SMS on their own. Without the contact link, the alert opens your SMS app with the message ready.
- Browsers slow timers in background tabs, so in-app Night Out reminders can be late. Notifications or phone reminders through ntfy help, but scheduled ntfy reminders can't be recalled if you get home early.
- The extension was tested on mock pages, not live accounts, and the big sites change their markup without notice.
- The misspelling check is English and Hinglish only.

## What's next

A keyboard for Android and iOS, steadiness from the phone's motion sensors, SMS alerts from a small server for people who won't install ntfy, one-tap booking through ride-app APIs, and a proper consented study.

## License

MIT
