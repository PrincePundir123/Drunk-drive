# SecondLook

The pause before a bad decision.

**Live app:** https://secondlook1.vercel.app/ (works on any phone or laptop, no signup)
**Demo video:** [add your YouTube link here]
**Built for:** Beginner's Paradise, FirstCommit (Devpost)

SecondLook is a mobile web app and a browser extension that helps people who've been drinking get home safely. While you're sober, you make a plan: who your safe contact is, how you're getting home, and what should happen if you stop answering. Later that night it notices when your typing drifts away from your own sober pattern and asks, gently, if you want a second look. If you don't respond, it checks in, puts your planned ride one tap away, and only if you agreed beforehand, alerts your contact.

## The problem

In India in 2022, 4,201 people were killed in crashes caused by drunk driving or drugs, 26.8% more than the year before (Ministry of Road Transport and Highways, *Road Accidents in India 2022*, Table 3.1). That's about one death every two hours.

Nobody drives drunk because they think it's safe to drive drunk. They do it because alcohol damages the judgment they'd need to notice they're impaired, and feeling fine is one of the symptoms. So an app that says "you might be drunk" and leaves the decision to you is asking the one person who can't decide well tonight.

SecondLook moves the decision earlier. The sober you makes the plan in the afternoon, and the app keeps that promise at 2am.

## Who it's for

- People who drink socially and want a safety net they set up themselves, not one someone else puts on them.
- Their friends and family, who'd rather get a message than a phone call from a hospital.
- Anyone who has ever sent a message at night they regretted in the morning. The same "second look" works there too.

It's built with India in mind (Uber, Ola and Rapido links, 112 as the emergency number, Hinglish words in the typo checker), but the idea works anywhere.

## What it does

1. **Set up while sober.** Pick a safe contact and decide what they'll hear. Take a 2-minute baseline: a reaction test, a steady-hand tracking test and a short typing test. That's your normal, measured against nobody but you.
2. **Plan the night.** Start a Night Out: how you're getting home (cab, a friend, walking or staying over), when you'll be home, and a note to later-tonight you, like "Don't drive, Alex. Seriously."
3. **Get a second look.** When a message you type looks very different from your usual typing, SecondLook holds it and asks "Want a second look?". It shows your own plan first. You can edit, or send it anyway. It never blocks you.
4. **Check-in.** If you ignore the prompt, a check-in starts with a countdown. One tap opens the ride you planned. You can call or text your contact, or prove you're fine with a 15-second reaction test.
5. **Alert, only if you agreed.** If the countdown runs out, your contact gets an end-to-end encrypted alert on their phone. They can reply "I'm on my way", and you see it on your screen.
6. **Nothing hidden.** Every prompt, check-in and alert goes into a plain-English log you can read and download. After anything is flagged, your safety settings lock for 6 hours, so a drunk you can't quietly switch off what the sober you decided.

## Try it in two minutes (nothing to install)

1. Open https://secondlook1.vercel.app/ and click **Try the 2-minute demo**. It loads a sample user (Alex), a safe contact (Priya) and a Night Out plan.
2. On the home screen, click **Open contact view** and put the two windows side by side. The second window is what Priya sees on her phone.
3. Go to **Messages** and tap **Simulate an impaired message**. The "Want a second look?" prompt appears.
4. Don't touch it. In the demo the prompt waits 20 seconds, then the check-in starts. After 30 more seconds the alert reaches the contact window.
5. In the contact window, tap **I'm on my way**. A banner appears on Alex's screen.
6. Open **Log** to see every step written down.

On a phone you can install it: in Chrome open the menu and tap **Install app**, or in Safari tap **Share → Add to Home Screen**. It then opens full screen from its own icon and works offline.

To leave the demo, click **Exit** next to "Demo" at the top.

## Run it on your own computer

You need [Node.js](https://nodejs.org/) 18 or newer. There are no packages to install.

```bash
git clone https://github.com/PrincePundir123/Drunk-drive.git
cd Drunk-drive
npm start      # serves the app at http://localhost:5173
npm test       # runs the 38 unit tests
```

Then open http://localhost:5173 in Chrome or Edge.

You can also just double-click `index.html`. Everything works except the offline mode and location sharing, because browsers only allow those on `http://localhost` or `https://`.

To publish your own copy, import the repo into Vercel (Framework preset: **Other**, no build command) or turn on GitHub Pages (**Settings → Pages → main / root**). It's all static files, so there's nothing to build.

## Install the browser extension (optional)

The extension brings the second look to WhatsApp Web, Instagram DMs and Gmail on a laptop.

1. Open the web app, finish setup and the baseline (or load the demo).
2. Go to **Settings → Browser extension**, click **Show my extension code** and copy it.
3. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the `extension/` folder from this repo.
4. Click the SecondLook icon in the toolbar, paste the code and press **Import**.
5. Reload any open WhatsApp Web, Instagram or Gmail tabs.

The code you paste contains your baseline numbers and settings. It never contains any words you've typed.

## How it works

### The baseline and the score

During the 2-minute baseline, SecondLook records eight signals: reaction time, tracking error on a moving dot, time between keys, rhythm variability, corrections (backspaces), long pauses, typos in the typing test, and misspelled words in messages. For each one it keeps a running average and spread (Welford's algorithm, so it never needs to store the raw samples).

Later, each new reading is turned into a z-score, which means "how many of your usual spreads away from your usual are you right now":

```
z = (now − your usual) / max(your usual spread, a percentage floor, a minimum floor)
score = 100 × (1 − e^(−(0.6 × weighted average of z + 0.4 × largest z) / 2))
```

A few details matter here:

- Only changes in the impaired direction count. Typing faster than usual never counts against you.
- The floors stop a short baseline from causing false alarms. If your baseline happened to be very consistent, a tiny wobble later won't look like a big change.
- The score runs from 0 to 100. Below 40 looks like you, 40 to 64 is a bit different, and 65 or more is very different.
- The prompt appears at 55 by default. You can choose protective (45) or gentle (65) in settings, and a Night Out moves it one step more protective.
- The baseline keeps learning from messages that look normal, but never within 6 hours of a flag, so a drunk night can't become the new normal.

### Privacy: how it checks typing without reading your messages

The recorder only keeps timings and counts: when each key was pressed, how many backspaces, how long the pauses were. When you press send, the text is read once, in memory, to count misspelled words against a built-in dictionary (about 2,500 everyday English words plus texting slang and common Hinglish). Then it's gone. Message text is never saved and never sent anywhere. The practice chat in the app lives in memory and disappears when you reload.

Your profile, baseline, plan and log are stored in your own browser (localStorage; the extension uses chrome.storage). There's no server and no account.

### Alerts and encryption

```
 your phone                                               contact's phone
 ┌────────────────────────────┐                         ┌──────────────────────┐
 │ SecondLook web app         │   "Alex may need help"  │ ntfy app             │
 │  encrypts the alert with   │ ──────────────────────▶ │  (notification only) │
 │  AES-GCM (Web Crypto)      │                         └─────────┬────────────┘
 │                            │  encrypted   ┌─────────┐          │ opens
 │                            │ ───────────▶ │ ntfy.sh │ ───────▶ ▼
 │                            │ ◀─────────── │  relay  │ ◀─────── contact.html
 └────────────────────────────┘  encrypted   └─────────┘   decrypts, replies
```

When you create a contact link, the app makes two random topic names and a 256-bit AES-GCM key. The link looks like `contact.html?a=<alertTopic>&r=<replyTopic>#k=<key>`. Browsers never send the part after `#` to any server, so the key only ever exists on your phone and your contact's phone. The relay, [ntfy.sh](https://ntfy.sh) (a free, open-source notification service), only ever sees scrambled data plus a generic "may need help, tap to open" notification with your first name. Your contact's replies come back the same way, encrypted.

ntfy is the only network service SecondLook uses, and only after you've set up the contact link.

### The browser extension

The extension (Manifest V3) listens for Enter and the send button on WhatsApp Web, Instagram DMs and Gmail. It uses capture-phase listeners so it sees the key press before the site does. If a message looks unlike you, it holds it and shows the prompt inside a closed Shadow DOM, so the website's styles and scripts can't interfere with it. **Send anyway** really sends by clicking the site's own send button. If you ignore the prompt, it opens the web app's check-in.

It's built to fail open: if anything inside the extension breaks, your message sends normally. A safety tool that eats your messages would get uninstalled on day one.

## Technologies used

| What | Used for |
|---|---|
| HTML, CSS, JavaScript (no framework) | The whole app. No build step, so it runs from a single `index.html` and loads fast on cheap phones. |
| Progressive Web App (manifest + service worker) | Installing from a link, full-screen app mode, offline support |
| localStorage | Keeping all your data on your own device |
| Web Crypto API (AES-GCM, 256-bit) | End-to-end encryption of alerts and replies |
| ntfy.sh | Free push notifications and the encrypted relay between you and your contact |
| Chrome/Edge extension, Manifest V3, Shadow DOM | The second look on WhatsApp Web, Instagram and Gmail |
| Canvas | The tracking test and the animated background |
| Node.js (built-in `node:test`) | 38 unit tests and a tiny local dev server |
| Playwright, axe-core, Lighthouse | End-to-end browser tests, accessibility checks, performance checks |
| Vercel | Hosting the live version |
| Fonts: Outfit and Atkinson Hyperlegible | Self-hosted (SIL Open Font License), so nothing loads from a CDN |

No external JavaScript libraries are loaded by the app. The QR code for sharing the contact link is drawn by a small encoder written for this project (`js/qr.js`).

## Design decisions

The same person meets SecondLook in two very different states, so the interface has two modes, both in the same warm, light style.

**Sober Mode** is for setup, the dashboard, the log and settings. It can show more detail because you're thinking clearly.

**Night Mode** is for the prompt, the check-in, the alert, reminders and the contact's page. It assumes you're in a dark bar at 2am, holding a phone in one hand, maybe drunk. So each screen has one main action, placed at the bottom where your thumb is (64px tall). Body text is 20px and key text 32px. Every colour pair reaches WCAG AAA contrast (7:1 or better). It shows your own words first ("You planned to take an Uber home"), and the main button says exactly what it does: "Open Uber, like you planned". The countdown is clear but calm. Nothing flashes red at you.

The logo is an eye with a pause symbol in the pupil. It doubles as a status display: the lid lowers when things look less like you, and the iris drains as the check-in counts down.

All colours, sizes and spacing come from one file, `css/tokens.css`. Screenshots of every screen before and after the redesign are in `docs/restyle/`.

## How I know it works

- **38 unit tests** (`npm test`) cover the scoring maths, keystroke analysis, the dictionary, encryption and decryption, contact links, the QR encoder, the code that moves your baseline into the extension, Night Out logic, ride links and the study analysis.
- **Seven end-to-end browser suites** (Playwright in Microsoft Edge, 167 checks in total) click through every flow. They cover setup, baseline, prompt, check-in, alert, Night Out, rides and 112, the contact page with two browsers talking through the real ntfy relay, the study page, a keyboard-only walkthrough, and the real unpacked extension on test pages served at the WhatsApp Web and Gmail addresses. These live outside the repo because they need Playwright installed.
- **Accessibility:** axe-core finds 0 violations on 24 screen states at phone and desktop sizes. Everything works with the keyboard alone, with a visible focus ring. Countdowns are announced to screen readers at 30, 10 and 5 seconds. There's no sideways scrolling at 320px width or at 200% zoom, and animations turn off if your system asks for reduced motion.
- **Lighthouse (mobile):** the main page scores 99 for performance and 100 for accessibility, best practices and SEO. The contact and study pages score 100 for performance and accessibility. They're marked `noindex` on purpose, because a private contact link should never show up in Google.

**What's not proven yet:** I built a validation study page (`study.html`) that measures false alarms using safe stand-ins for impairment (typing with your other hand, counting backwards while typing). I haven't run it with enough people yet, so I don't have accuracy numbers to report. I'd rather say that than show made-up ones.

## Challenges I ran into

- **Designing for someone who's drunk.** Normal UI rules assume a focused user. I had to design for someone who can't read small text, will tap the wrong thing, and might be annoyed at being asked. That's where the one-action screens, big buttons, and "ask, don't block" came from.
- **Measuring typing without keeping the words.** My first version stored words to calculate typos, and I realised that meant storing pieces of private messages. I rebuilt it so only timings and counts are kept, and the text is read once in memory at send time and then thrown away.
- **Making the extension safe for other people's websites.** Catching Enter before WhatsApp does, without ever losing a message, took a lot of testing. The rule became: if anything fails, send the message normally.
- **Encryption without a server.** I wanted the contact to get alerts without me running a backend that could read them. Putting the key in the URL fragment, which browsers never send to servers, solved that.
- **Performance.** An animated background I added made the page slower: Lighthouse performance dropped to 94, and the page stayed blocked for 210 ms while it drew. I changed it to draw the still grid once, redraw only the moving ripple, and start after the page loads. It went back to 98 to 99, with no blocking time.
- **Colour contrast.** The coral colour I wanted for buttons failed accessibility contrast with white text (2.8:1). I kept the bright coral for decoration and used a deeper shade for buttons and text.
- **Keeping two copies of the code in sync.** The web app and the extension share the scoring code. I wrote a script that copies it into the extension (`npm run build:ext`) and a test that fails if the copies are out of date.

## What I learned

- How to turn a fuzzy idea ("is this person impaired?") into numbers: z-scores, running averages with Welford's algorithm, and why floors matter when you have little data.
- How end-to-end encryption actually works in the browser with the Web Crypto API, and how to share a key without a server.
- How browser extensions work: content scripts, capture-phase events, Shadow DOM, and Manifest V3 permissions.
- How service workers and PWAs make a website install and work offline like an app.
- That accessibility is something you measure (axe, Lighthouse, keyboard-only testing), not something you guess.
- That with safety tools, being honest earns more trust than big claims. SecondLook never says "you're safe to drive", because it can't know that.

## Questions judges might ask

**Can SecondLook tell if I'm drunk?**
No, and it never claims to. It can't measure blood alcohol. It notices when you're behaving unlike your sober self: slower, less steady, more mistakes. Tiredness or stress can look similar, which is exactly why it asks instead of blocking. It will never tell you that you're fine to drive.

**Why typing, and not a breathalyzer or the camera?**
Because people already type at night, so it needs no extra hardware and no new habit. A breathalyzer costs money and nobody carries one. A camera feels like surveillance. Typing rhythm is something you do anyway.

**Doesn't comparing to a 2-minute baseline cause lots of false alarms?**
That's the main risk, so there are three protections. The floors in the formula stop a very consistent baseline from making small changes look big. Only the impaired direction counts. And the baseline keeps learning from normal messages over time. A false alarm costs you one tap on "Send it anyway". Sensitivity can be changed in settings.

**Does it read my messages?**
No. It keeps key timings and counts. At send time it reads the text once, in memory, only to count misspelled words, and then discards it. Nothing you type is saved or sent.

**Why is there no login?**
On purpose. All your data stays on your phone, so there's nothing to log in to. Your contact gets a private encrypted link instead of an account. The downside: if you clear your browser data, your setup is gone (you can download your log first).

**Why a web app and not an Android app?**
It installs from a link on both Android and iPhone, works offline, and judges can try it in seconds. It behaves like an app once installed. The real long-term version would be a phone keyboard (an Android or iOS keyboard), since that's where people actually type at night.

**What stops me from just turning it off when I'm drunk?**
After anything is flagged, settings, pausing the extension and replacing the baseline all lock for 6 hours. You can unlock early by passing the 15-second reaction test. Clearing browser data still works. The lock is there to slow you down, not to trap you.

**Could someone use this to spy on a partner?**
It's built so that doesn't work. Everything runs on the user's own device and there's no dashboard for anyone else. The contact receives nothing until an alert fires, and alerts only fire under rules the user chose. Even then they get a short notice and a general reason, never messages or typing data. Location is only shared if the user ticked that box. And everything SecondLook does is visible to the user in the log.

**What is ntfy, and is it safe?**
ntfy.sh is a free, open-source push notification service. SecondLook only sends it encrypted data and a generic "may need help" message. It can't read the reason, the location or the replies, because it never has the key.

**What if my contact doesn't respond?**
The check-in screen always has your planned ride, call and text buttons, and a **Call 112** button (India's emergency number) behind a confirm step, so you can't dial it by accident.

**Did you test the extension on the real WhatsApp?**
The automated tests run the real extension on test pages served at the WhatsApp Web and Gmail addresses, because automated tests can't log in to real accounts. The site-specific selectors all live in one file (`extension/src/selectors.js`) with fallbacks, because big sites change their page structure without warning.

**Why no React or other framework?**
The app is small, and I wanted it to load fast on low-end phones and run straight from `index.html` without a build step. Plain JavaScript also meant I had to understand every part of it myself.

## Limitations

- These are behavioural signals, not a breathalyzer. Tiredness, stress or a new keyboard can look similar.
- Browsers can't send SMS on their own. Without the contact link, the alert opens your SMS app with the message ready to send.
- Phones slow down timers in background tabs, so in-app Night Out reminders can arrive late. Phone reminders through ntfy help with that.
- The typo check only understands English and Hinglish.
- The extension has been tested on test pages, not on live accounts.
- There are no accuracy numbers yet (see "What's not proven yet" above).

## What's next

A real keyboard for Android and iOS, steadiness readings from the phone's motion sensors, SMS alerts for contacts who won't install ntfy, one-tap booking through ride-app APIs, typo checking in Hindi and other Indian languages, and running the validation study with real participants.

## How AI was used

The hackathon rules ask for this, so here it is plainly. I built SecondLook with a lot of help from Claude Code, an AI coding assistant made by Anthropic. I came up with the idea and the problem, wrote the requirements (including the privacy rules: no message text stored, no backend, consent before any alert), chose the design direction and the Indian data source, and tested and deployed the app. A large part of the code, the tests and the documentation was written by the AI following my instructions, and I worked with it step by step: asking questions, asking for changes and checking the results in the browser.

## Project structure

```
index.html                   landing page and app shell
css/tokens.css               colours, type, spacing for Sober Mode and Night Mode
css/style.css                all components (uses only the tokens)
js/app.js                    screens, prompt, check-in, alerts, Night Out, log, settings, demo
js/metrics.js                scoring (pure functions, also used by the tests)
js/tests.js                  reaction, tracking and typing tasks; keystroke recorder
js/words.js                  dictionary (~2,500 words, texting slang, Hinglish)
js/rides.js                  ride, call, message and 112 links
js/secure.js, js/relay.js    AES-GCM encryption; ntfy publish and subscribe
js/qr.js                     QR code encoder for the contact link
js/nightout.js               Night Out logic
js/share.js                  moving the baseline and log between the app and the extension
js/sonar.js                  the animated dot background
contact.html, js/contact.js  the safe contact's page
study.html, js/study.js      validation study page (stand-ins, no alcohol)
extension/                   Chrome/Edge extension (Manifest V3)
scripts/                     dev server, extension sync, icon maker, study analysis
tests/                       unit tests (node:test)
docs/                        design notes, reference analysis, before/after screenshots
assets/                      icons and self-hosted fonts
```

## Credits

- Road accident data: Ministry of Road Transport and Highways, Government of India, [Road Accidents in India 2022](https://morth.gov.in/backend/documents/uploaded/1755600426_RA_2022_30_Oct.pdf).
- Fonts: [Outfit](https://github.com/Outfitio/Outfit-Fonts) and [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) (Braille Institute), both under the SIL Open Font License. License files are in `assets/fonts/`.
- Notifications: [ntfy.sh](https://ntfy.sh).

## License

MIT. See [LICENSE](LICENSE).
