# SecondLook 👁️

**The pause before a bad decision.**

Drunk driving doesn't keep happening because people don't know it's dangerous. It keeps happening because alcohol breaks the judgment you'd need to notice you're too drunk to drive. SecondLook doesn't count on that judgment. It learns your sober baseline, notices when you drift from it, and follows a plan **you made while sober**.

> Built for **Beginner's Paradise: FirstCommit**.

## What it does

1. **Learns your sober self.** A 2-minute baseline measures reaction time, how steady your hand is (following a moving dot), and your typing rhythm. After that it keeps learning quietly from messages you send on normal days (timing numbers only, never the words).
2. **Notices the drift.** Before a message is sent, SecondLook compares its typing rhythm, corrections, long pauses and misspellings with *your* baseline. It never compares you with other people.
3. **Steps in gently.** *"This looks a little different from how you usually text. Want a second look?"* You can edit, send anyway, or take a 1-minute check. It's a short pause, not a lecture.
4. **Brings in help.** If you don't answer, or the signs get stronger (several flagged messages, or a quick check well outside your baseline), it checks in with a countdown and offers a ride (Uber, Ola, Rapido, Lyft), a text or a call to your safe contact, or a 15-second reaction check to show you're okay.
5. **Alerts your safe contact, but only if you agreed.** You give that consent during setup, while sober. The app shows you the alert, and it's recorded in the log.

### Things we're proud of
- **Your sober decisions are protected.** After something is flagged, safety settings lock for 6 hours. A 15-second reaction check unlocks them, so an impaired you can't switch off what a sober you set up.
- **Transparency log.** Every prompt, check-in, alert and settings change is written there in plain words. You can download it.
- **Private by design.** Analysis runs on your device and only looks at timing and corrections. Nothing is uploaded.
- **Honest about limits.** It can't measure blood alcohol, so it never tells you you're "fine to drive".
- **Real alerts without a server.** Optional instant push alerts go through [ntfy](https://ntfy.sh). Your contact subscribes to a private topic, and nobody needs an account.
- Works on phones and laptops, can be installed as an app (PWA), works offline, and is keyboard and screen-reader friendly. The tracking task can be skipped by people who can't use a pointer.

## Try it

**Fastest:** open `index.html` in any browser and click **Try the 2-minute demo**. Then, in Messages, tap **🧪 Simulate an impaired message** and don't respond. You'll see the prompt, the check-in, and the alert to the (fictional) contact.

**Local server** (recommended; location sharing and offline mode need it):

```bash
npm start          # → http://localhost:5173  (Node 18+, no dependencies)
npm test           # unit tests for the scoring logic
```

**Deploy for free:** push to GitHub → *Settings → Pages → Deploy from branch → main / root*. It's all static files, so there's no build step.

## Install the browser extension (WhatsApp Web, Instagram DMs, Gmail)

The extension gives the same second look where people actually text. It runs in Chrome and Edge.

1. Open the web app over http(s): run `npm start` (→ http://localhost:5173) or use your GitHub Pages link, then finish setup and calibration.
2. Go to **Settings → Use it in WhatsApp, Instagram & Gmail → Show my extension code** and copy the code. It contains timing numbers and settings, never messages.
3. In Chrome, open `chrome://extensions` (in Edge, `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the `extension/` folder.
4. Click the SecondLook icon in the toolbar, paste the code and press **Import**.
5. **Reload** any open WhatsApp Web, Instagram or Gmail tabs.
6. Optional: on any other site, open the popup and tick **Also use on <site>**. SecondLook asks for permission for that one site only; there's no `<all_urls>` access.

How it behaves:
- It records keystroke **timing and counts only**. When you press send, it reads the text once, in memory, to count misspelled words, then throws it away.
- If the message looks unlike you, it holds it back and shows the prompt inside a closed Shadow DOM. **Send anyway** really sends: it clicks the site's own send button, with a synthetic Enter as the fallback.
- If you ignore the prompt, or several messages are flagged, it opens the web app's check-in in a new tab, and the normal check-in and alert flow takes over.
- If anything goes wrong inside the extension, your message sends normally (fail open).
- Every action is written to the popup's log. Use **Copy log for the web app**, then **Log → Import extension log** in the web app, to keep one downloadable record.
- All site selectors are in [`extension/src/selectors.js`](extension/src/selectors.js). WhatsApp and Instagram change their markup often, so that's the one file to update when a site breaks.
- Shared logic is **not duplicated**: `npm run build:ext` copies `js/metrics.js`, `js/words.js`, `js/share.js` and `js/rides.js` into `extension/lib/`, and `npm test` fails if the copies are stale.

> A full product would be a **mobile keyboard** (an Android IME or an iOS keyboard extension), so it works in every messaging app on the phone where people actually text late at night. The browser extension is the closest honest version we can build and demo on the web.

## Two-way alerts with your safe contact (end-to-end encrypted)

1. In **Settings → Real notifications for <contact> → Set up encrypted alerts**, SecondLook generates two random 128-bit topics (alert and reply) and a 256-bit AES-GCM key on your device.
2. Share the link (QR code, WhatsApp or SMS). It looks like `…/contact.html?a=<alertTopic>&r=<replyTopic>#k=<key>`. The key sits in the `#fragment`, which browsers never send to a server. When your contact opens it once, the key is saved on their phone and removed from the address bar.
3. Your contact installs the free [ntfy](https://ntfy.sh) app and subscribes to the alert topic (the page has one-tap buttons).
4. When an alert fires, the app sends the details **encrypted** to `<alertTopic>-d`, and a generic *"SecondLook: Alex may need help – tap to open"* notification to the alert topic. ntfy.sh never sees plaintext details, and the notification link carries no key.
5. On `contact.html`, your contact can tap **I'm calling now**, **I'm on my way** or **Can't come – book them a cab**. The encrypted reply appears as a banner on your check-in screen, and you can answer "Thanks, I'm staying put".
6. If ntfy.sh can't be reached, or a message can't be decrypted, both sides say so clearly, and the pre-filled SMS / WhatsApp buttons still work.

## How the scoring works

Each signal is converted to a z-score against your own baseline:

```
z = (now − your usual) / max(your usual spread, % floor, absolute floor)
```

- Only drifts in the impaired direction count. Typing faster or cleaner than usual is never a warning.
- Floors stop a small baseline from triggering false alarms.
- Score = `100 · (1 − e^(−(0.6·weighted-average z + 0.4·max z) / 2))`: 0–39 *like you*, 40–64 *a bit different*, 65+ *very different*.
- Sensitivity (gentle, balanced or protective) sets when the message prompt appears.
- The baseline only learns from messages that looked normal, and never within 6 hours of a flag, so it can't drift toward "impaired".

| Signal | Why it matters |
|---|---|
| Reaction time | Alcohol slows how fast you respond |
| Tracking error | Fine motor control gets less steady |
| Time between keys / rhythm variability | Typing gets slower and more uneven |
| Corrections, long pauses | More hesitation and fixing |
| Typos / misspelled words | Accuracy drops |

## Project structure

```
index.html            landing page + app shell
css/style.css         all styling (dark, mobile-first)
js/storage.js         localStorage wrapper (falls back to memory)
js/words.js           everyday dictionary incl. texting slang + Hinglish
js/metrics.js         pure scoring functions (also used by the tests)
js/tests.js           reaction, tracking and typing tasks + keystroke recorder
js/app.js             views, the prompt, check-in escalation, log, settings
sw.js, manifest       offline support + installable app
tests/                node:test unit tests
scripts/serve.js      zero-dependency dev server
```

## Limitations (on purpose, and honestly)
- It's a prototype chat. The full version would be a **custom keyboard** so it works in WhatsApp, Instagram and other apps.
- Browsers can't send SMS silently. Without ntfy, the alert opens your SMS app with the message already written.
- These are behavioural signals, not a breathalyzer. Being tired or stressed can look similar, which is why SecondLook asks and suggests instead of blocking you.
- Someone who is determined can clear their browser data. The settings lock is there to add friction, and it isn't meant to be a cage.

## What's next
- Keyboard extension (Android IME / iOS keyboard) and phone-motion steadiness from the accelerometer
- Server-side SMS (e.g. Twilio) for automatic alerts without extra apps
- A time-of-night schedule, and linking with ride apps' APIs to book in one tap
- A small user study to tune thresholds with real (consented) data

## License
MIT
