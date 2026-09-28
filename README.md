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
