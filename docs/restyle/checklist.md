# Restyle checklist: every screen and state

Use this to check each screen after the restyle. Each item gives a short name, how to reach it, and the mode it renders in.

- **day** means Sober Mode (`data-mode="day"`)
- **night** means Night Mode (`data-mode="night"`), set on `<body>` or on a wrapper element
- **Demo** means you clicked "Try the 2-minute demo" (`#try-demo`). This loads user Alex, contact Priya, and an Uber Night Out plan.

Home, Messages and Check render in **night** when a Night Out is active or something was flagged in the last 6 hours. Otherwise they render in **day**. Setup, Calibrate, Log and Settings always render in **day**, except the Settings lock band, which is night. Many states can be forced by editing `localStorage['secondlook.v1.state']` and reloading. The e2e scripts do this.

---

## 1. App shell (index.html, all routes)

- [ ] **Skip link**: press Tab on first load. It jumps to `#app`. day/night.
- [ ] **Top bar, brand only**: before setup, on welcome, setup and calibrate. The nav is hidden. day.
- [ ] **Top bar with top nav** (`#topnav`, desktop): after setup and baseline, on any app route. day/night.
- [ ] **Active nav link** (`aria-current="page"`): the current route's link in the top nav and tab bar. day/night.
- [ ] **Bar CTA "Try the demo"** (`#bar-cta`): shows on `#/welcome` only. day.
- [ ] **Demo pill with Exit button** (`#demo-badge`): any route in Demo. Exit opens a native confirm. day/night.
- [ ] **Bottom tab bar** (`#tabbar`, mobile): after setup and baseline, at narrow widths. `body.has-tabbar` adds bottom padding. day/night.
- [ ] **Boot state** (`html[data-boot="app"]`): a returning user reloads. The landing page and bar CTA are hidden before first paint, with no flash.
- [ ] **Sonar background canvas** (`canvas.sonar`): any page after idle. It changes colour when the mode flips and goes quiet while a check-in is open. day/night.
- [ ] **Toast** (`#toast.show`): see section 12 for every message. day/night.
- [ ] **noscript message**: load with JavaScript disabled.
- [ ] **Native `confirm()` dialogs**: the browser draws these, so they can't be styled. They cover exit demo, clear log, delete all data, reset link and turn off notifications.
- [ ] **Focus ring**: every focusable element needs an outline of at least 2px. `kb-e2e.js` fails without it. day/night.
- [ ] **No sideways scroll at 320, 360 and 640px**: every route. Checked by `zoom-e2e.js` and `kb-e2e.js`.

## 2. Welcome / landing (`#/welcome`; also any route when there is no profile)

- [ ] **Hero copy**: the badge, the settling headline (`data-settle`), and the two CTAs "Try the 2-minute demo" and "Set up SecondLook". day.
- [ ] **Headline settle animation**: before (`.settle:not(.in)`) and after (`.settle.in`). With reduced motion there is no animation. day.
- [ ] **Hero phone demo, typing state**: the message types itself into `#pc-text`. day.
- [ ] **Hero phone demo, sheet up** (`.phone-sheet.up`): shows the eye, the quote, and "Want a second look?". day.
- [ ] **Hero phone "Play it again" button** (`.replay`): appears after the animation ends. day.
- [ ] **Hero phone with reduced motion**: shows the final state at once. day.
- [ ] **Pixel-art planet canvases** (`canvas[data-pixel]`: hero, corner, cta). day/night.
- [ ] **"Why it matters" record section**: night.
- [ ] **How it works, 4 cards**: day.
- [ ] **Modes: Sober Mode card**: day.
- [ ] **Modes: Night Mode card**: night.
- [ ] **Promise: "Always" card**: day.
- [ ] **Promise: "Never" card**: night.
- [ ] **CTA end section**: night.
- [ ] **Footer**: day.

## 3. Setup (`#/setup`, day)

- [ ] **Step 1 "What should we call you?"**: the stepper reads "Step 1 of 5", and the Back button is hidden.
- [ ] **Step 2 "Who's your safe contact?"**: the two fields sit side by side (`.row2`).
- [ ] **Step 3 "Where's home?"**: the button reads "Skip for now" when the field is empty and "Next" once you type.
- [ ] **Step 4 "Your promises"**: four checkboxes. The button reads "Save my plan".
- [ ] **Step error** (`.form-error`, role alert): press Next with an empty name, a bad phone, or the last two boxes unticked.

## 4. Calibrate (`#/calibrate`, day)

- [ ] **First-time intro**: the stepper reads "Step 5 of 5", the title is "Now, the sober you", there are three data notes, and "Start the tasks". Reach it by finishing setup, or by going to any route when there is a profile but no baseline.
- [ ] **Recalibrate intro**: no stepper, the title is "Recalibrate your baseline", and there is a Cancel link. Reach it from Settings > Recalibrate, or from Demo "Use my own baseline".
- [ ] **Task frame**: the stepper reads "Task n of 3", with a task-guide icon and hint.
- [ ] **Reaction pad, idle**: `data-state="idle"`, "Tap here to start".
- [ ] **Reaction pad, wait**: `data-state="wait"`, "Wait for green…".
- [ ] **Reaction pad, go**: `data-state="go"`, "TAP!".
- [ ] **Reaction pad, early**: `data-state="early"`, "Too soon!" or "Too fast to be real".
- [ ] **Reaction pad, result**: `data-state="result"`, shows the ms time.
- [ ] **Reaction pad, done**: `data-state="done"`.
- [ ] **Reaction progress dots**: done rounds show as `i.on`.
- [ ] **Tracking, before start**: canvas, hint, and "Can't use a pointer? Skip this task".
- [ ] **Tracking, "Start on the glowing dot" hint**: press away from the dot.
- [ ] **Tracking, running**: the hint is hidden (`.trk-hint.hide`) and the timer bar fills.
- [ ] **Tracking, Done or Skipped**: the skip button is disabled.
- [ ] **Typing task, "Sentence n of 2"**: the Next/Finish button stays disabled until you have typed 90% of the sentence.
- [ ] **Typing hints**: "Press Enter or tap…", "Keep going…", and the message shown when you paste.
- [ ] **Baseline saved summary**: the ok eye, the stats grid, and "Go to my dashboard".

## 5. Home (`#/home`)

- [ ] **Status "All quiet tonight"**: `data-level="ok"`, no flags, no Night Out. day.
- [ ] **Status "A bit different tonight"**: `data-level="caution"`, 1 or 2 flags, or a caution quick check within 3 hours. night.
- [ ] **Status "Please don't drive tonight"**: `data-level="high"`, 3 or more flags, or a high quick check. night.
- [ ] **Mode note line** (`.mode-note`): shows "Night Out active – home by…" or "Night Mode is on because…". night.
- [ ] **Demo bar** (`.demo-bar.demo-card`): shows "Open contact view" and "Use my own baseline". Demo only. day/night.
- [ ] **Night Out card, cab plan**: "You planned to take an Uber home. Here it is →", an "Open Uber" button, a note to self, the next check-in time, "I'm home safe", and in Demo "Trigger a check-in now". night.
- [ ] **Night Out card, friend plan**: a "Text Priya" button. Start Night Out with "A friend drives me" and leave the name empty. night.
- [ ] **Night Out card, walk or stay plan**: text only, no button row in the plan. night.
- [ ] **Night Out card, no more check-ins**: "No more check-ins tonight." night.
- [ ] **Action "Going out tonight?"** (primary): shows only when no Night Out is active. day.
- [ ] **Action "Get a ride home"**: this is the primary action during a Night Out whose plan is not a cab. day/night.
- [ ] **Action "Quick check"** link. day/night.
- [ ] **"Tonight" details**: closed when nothing is flagged, open when something is. The open state has the `timeline-mini` list and the last-check line. day/night.
- [ ] **"Your safety net" details**: key/value list, auto-alert on or off, real notifications on or off. day/night.
- [ ] **"Your sober baseline" details**: stats grid. day/night.
- [ ] **"Exit the demo" link button**: Demo only.

## 6. Messages (`#/chat`)

- [ ] **Chat head, day log, and seeded messages from "them"**: day/night.
- [ ] **Sent message** (`.msg.me`) and **received message** (`.msg.them`), with a time meta line. day/night.
- [ ] **Sent-after-second-look meta**: ", sent after a second look". Choose "Send it anyway" on a nudge. night.
- [ ] **"Simulate an impaired message" button**: Demo only. While it types by itself, the button is disabled. day/night.
- [ ] **Composer**: the textarea grows to 140px. Send is an icon button. day/night.
- [ ] **Practice-chat note**. day/night.

## 7. Quick check (`#/check`)

- [ ] **Intro**: "How am I doing?" and "Start the check". day/night.
- [ ] **"Simulate an impaired result" button**: Demo only. day/night.
- [ ] **Task frame**: same as calibrate, with 1 typing sentence and a 10-second tracking round. day/night.
- [ ] **Result "Looks like your usual self"**: `.result[data-level="ok"]`, no help panel. day/night.
- [ ] **Result "A bit different"**: `data-level="caution"`, with the help panel (rides and contact). night.
- [ ] **Result "Quite different"**: `data-level="high"`. A check-in opens 2.5 seconds later. night.
- [ ] **Result "Not enough data"**: level unknown, shown in the ok style. day/night.
- [ ] **"(simulated)" title suffix**: after using the sim button.
- [ ] **Comparison bars**: `.bars span.ok`, `.caution` and `.high` widths. day/night.
- [ ] **"Back home" and "Check again" row**. day/night.

## 8. Transparency log (`#/log`, day)

- [ ] **Header and three buttons**: Download, Import extension log, Clear log.
- [ ] **Empty state** "Nothing yet.": appears after you clear the log.
- [ ] **Night groups**: "Tonight", "Last night", and "The night of …".
- [ ] **Entry icons by type**: `li[data-type]` for night, extension, setup, baseline, nudge, checkin, alert, check, settings, ride, contact, data and action. CSS colours nudge, checkin, alert and night.
- [ ] **"Your data" notes list**.
- [ ] **Clear log while locked**: opens the Unlock modal (see 10.6).
- [ ] **Log before a baseline exists**: the route stays reachable with a profile but no baseline.

## 9. Settings (`#/settings`, day)

- [ ] **Unlocked page**: the section nav (`[data-jump]` buttons) and all groups enabled.
- [ ] **Locked band** (`.lock-band.lock`, night, role status): "Locked until HH:MM", with the "Unlock with a 15-second test" button. Reach it with any flag in the last 6 hours.
- [ ] **Locked tags on group headings** (`.locked-tag`) and the disabled fieldset or buttons.
- [ ] **Section jump**: it scrolls and focuses the group's h2.
- [ ] **You and your contact form**: profile fields, sensitivity, and the two timeout selects.
- [ ] **Form error**: bad phone or empty name.
- [ ] **Rides home, no address**: "No home address yet. Add it above."
- [ ] **Rides home, address only**: shows the address in bold and the "save your home location" hint.
- [ ] **Rides home, coordinates saved**: the "Forget home location" button appears.
- [ ] **Rides home, location error** (`#home-err`): location denied, or opened over file://.
- [ ] **Alerts to your contact, no link**: the privacy notes and "Set up real notifications".
- [ ] **Alerts, link active**: the QR code, the link textarea, "Copy the link", WhatsApp and SMS share, "Send a test alert", "Preview what Priya sees".
- [ ] **Alerts, "Send a test alert" in flight**: the button is disabled.
- [ ] **Alerts, "Reset or turn off" details**: open state, and the locked state.
- [ ] **Alerts, file:// warning** (`.form-error` paragraph).
- [ ] **Browser extension, before export**: the button is disabled when there is no baseline.
- [ ] **Browser extension, code revealed** (`#ext-code-wrap`): textarea, Copy and Download. There is also a file:// note.
- [ ] **Baseline group**: the Recalibrate button, which is disabled when locked.
- [ ] **Your data danger zone**: "Delete all my data", disabled when locked unless in Demo.
- [ ] **Settings before a baseline exists**: reachable. The export button is disabled.

## 10. Modals and bottom sheets (`#modal-root > .modal-backdrop > .modal`)

- [ ] **10.1 Get home safe, centred dialog** (day): tap "Get a ride home" on Home with no flags and no Night Out. It has ride chips (`a.ride`, with ✓ when prefilled), the ride hint, and Call, Text and WhatsApp buttons.
- [ ] **10.2 Get home safe, bottom sheet** (`.sheet`, sheet-grip, night): the same action during a check-in, a Night Out, or a flagged night.
- [ ] **10.3 Second look nudge** (`.sheet.rise`, night): type a sloppy message or use Simulate. It has the countdown eye, a reason, the compact plan card, the `data-secs` countdown bar, and Edit, Send anyway and Check how I'm doing. Escape or a click on the backdrop means Edit. On timeout the check-in opens.
- [ ] **10.4 Call 112 confirm** (sheet, night): tap the 112 button in the check-in top bar. Cancel has focus by default.
- [ ] **10.5 Import extension log** (day): Log > Import extension log. It has a code textarea, a file chooser, and an error line (`#log-import-err`).
- [ ] **10.6 Unlock with a quick test** (day): Settings > Unlock, or Log > Clear while locked. It has a reaction pad and a fail message (`#unlock-msg`).
- [ ] **10.7 Quick check before ending Night Out** (day): tap "I'm home safe" when something was flagged since the Night Out started and it is before the home-by time. Same reaction pad and fail message.
- [ ] **10.8 Going out tonight? form** (day): Home > Going out tonight. It has the mode radios, a provider select (shown for cab), a friend field (shown for friend), home-by time, check-in interval, a note, an ntfy checkbox, and an error line.
- [ ] **10.9 Phone reminders (ntfy topic)** (day): submit the Night Out form with the ntfy box ticked while online. It has the topic code and the ntfy app and browser links.
- [ ] **10.10 Night Out reminder, cab plan** (sheet, night): tap Demo "Trigger a check-in now", or wait for a scheduled reminder. It has "I'm OK" and "Heading home: open Uber". On timeout the check-in opens.
- [ ] **10.11 Night Out reminder, non-cab plan** (sheet, night): the button reads "I'm heading home now".
- [ ] **10.12 Modal focus**: the element with `[autofocus]` gets focus, otherwise the first focusable element. Focus returns to where it was when the modal closes.

## 11. Check-in overlay (`#checkin-root > .checkin[data-mode="night"]`, night, role alertdialog)

Ways to trigger it: the nudge times out; you send anyway 3 or more times in an hour, or once with a score of 85 or more; a quick check comes back high; you miss a Night Out reminder; you pass the home-by time by 30 minutes; or the extension opens `#/home?checkin=ext-*`. It also survives a reload.

- [ ] **Top bar**: the brand eye and the 112 button (`.e112`).
- [ ] **Asking, cab plan**: a countdown ring (`.ci-ring`, role timer) with `#ci-secs`, "Hey Alex. Just checking in.", a consent line, the compact plan, and "Why now". The primary action is "Open Uber, like you planned".
- [ ] **Asking, no cab plan**: the primary action is "Book a ride home".
- [ ] **Asking, after a failed prove**: the `.ci-note` paragraph shows the slower-reaction message.
- [ ] **Asking, auto-alert off**: "You chose not to alert anyone…".
- [ ] **Asking, Call and Text pair, plus "I'm okay: take a 15-second test"**.
- [ ] **Proving**: "Quick reaction test", a reaction pad in `.ci-test`, and a Back button.
- [ ] **Alerted, preparing**: "Preparing the message…". This shows briefly while location is fetched.
- [ ] **Alerted, SMS fallback** (no encrypted link): "Time to let Priya know", the alert text, "Send it by SMS", WhatsApp, Call, "Ride home" and "I'm safe".
- [ ] **Alerted, push failed** (link set up but offline): adds the "couldn't be delivered" note.
- [ ] **Alerted, pushed**: "We let Priya know", the encrypted note with a WhatsApp link, "Book a ride home", Call and "Also text", and "I'm safe, close this".
- [ ] **Expired** (auto-alert off and time ran out): "Nobody was contacted", ride and contact actions, and Close.
- [ ] **Responded**: "Good call, Alex", the note, the compact plan, the inline help, and Close.
- [ ] **Contact reply banner** (`.reply-banner`): "Priya is on the way – time" with "Thanks, I'm staying put". Reach it through the encrypted link, when the contact replies.
- [ ] **Reply banner, thanked**: "You replied: 'Thanks, I'm staying put.'"
- [ ] **Scroll lock**: `body.no-scroll` is set while the overlay is up, and the actions stay reachable at 400px tall.

## 12. Toasts (`#toast`, day/night)

- [ ] "Demo loaded. Try Messages next." (from Try the demo)
- [ ] "All data deleted" (after a reset)
- [ ] "Home address copied – paste it as destination" (tap Ola or Rapido with an address saved)
- [ ] "Tip: add your home address in Settings for one-tap rides" (tap a ride with no address)
- [ ] "Unlocked for 15 minutes" (after passing the unlock test)
- [ ] "Settings are locked right now." (save while locked)
- [ ] "Saved ✓" or "No changes" (save settings)
- [ ] "Code copied ✓" or "Couldn't copy…" (extension code)
- [ ] "Link copied ✓" or "Select the link and copy it" (contact link)
- [ ] "Test alert sent ✓" or "Couldn't reach the alert service…"
- [ ] "Home location saved ✓"
- [ ] "N entries imported" (log import)
- [ ] "Couldn't send — call or text instead" (the thanks reply failed)
- [ ] "Safe trip. Tap 'I'm home safe' when you're in." (reminder answered "heading home")
- [ ] "Welcome home" (Night Out ended)
- [ ] An error message from creating the link (when crypto is unavailable)
- [ ] The toast is hidden whenever a modal opens.

## 13. Contact page (`contact.html`, night; `body.contact-page`)

- [ ] **No link / no key**: "Safe contact" with instructions. Open `contact.html` without `?a=&r=`, or on a fresh device without `#k=`.
- [ ] **Idle**: "You're Alex's safe contact", "No alerts right now", and the ntfy steps.
- [ ] **Connection indicator** `#conn.connecting`, `.open` ("● Listening"), `.reconnecting` and `.offline`. It is empty when there is no link.
- [ ] **Offline banner** (`#banner .warn`).
- [ ] **Reconnecting banner**.
- [ ] **Decrypt-failed banner**: a forged or unreadable message arrived.
- [ ] **Test alert card** (`.alert-card.test`): "Alex sent a test".
- [ ] **Urgent alert card** (`.alert-card.urgent`): "Alex may need help", the reason, and "Open their location" or "They chose not to share their location."
- [ ] **Reply buttons**: "I'm calling now" is a tel link when a phone is set, otherwise a button. Also "I'm on my way" and "Can't come: book them a cab".
- [ ] **No-phone note**.
- [ ] **Sent status** (`.sent`): "Sent ✓ …" or "Couldn't send…", or "Home address copied…".
- [ ] **Ride list after "book them a cab"** (`.help-inline .rides`, `a.ride`), with the home-address line.
- [ ] **Emergency, ask**: "Call 112" danger button.
- [ ] **Emergency, confirm**: "Call 112 now?", "Yes, call 112" (tel link) and Cancel.
- [ ] **"From Alex" status updates list** (`.updates`).
- [ ] **"Your last answer" line**.
- [ ] **ntfy steps**: topic code and a Copy link button. After copying it reads "Copied ✓".
- [ ] **"What is this?" explainer**: closed and open states.

## 14. Validation study (`study.html`, day)

- [ ] **Intro**: warning box, "What we record", the start form (code and checkboxes), and "Load my file".
- [ ] **Intro with resume panel**: shows when a session is in progress. Resume and Start over.
- [ ] **Start form error**: bad code, or statements not confirmed.
- [ ] **Continue-file error** (`#cont-err`).
- [ ] **Baseline intro**: "Baseline — just be yourself".
- [ ] **Task screens**: reaction, tracking, typing, and free typing (`#free`, "Message n of N"). The stepper bar has no ARIA.
- [ ] **Task reminder line** (`.ci-note`): shows in the non-dominant and dual-task rounds.
- [ ] **Condition intro, sober retest**: no stand-in note.
- [ ] **Condition intro, non-dominant hand and dual task**: with the stand-in note.
- [ ] **Condition intro, tired**: with the tiredness select form and its error.
- [ ] **Finish**: the ok eye, the rounds bar list, "Download my file", and "Next participant".

## 15. Extension popup (`extension/popup/popup.html`, day, 360px wide)

- [ ] **Status "Not set up yet"** (`.status.off`).
- [ ] **Status "Paused until …"** (`.status.off`).
- [ ] **Status "All quiet"** (`.status` with no modifier).
- [ ] **Status "N messages looked off tonight"** (`.status.caution`).
- [ ] **Status "Please don't drive tonight"** (`.status.high`, 3 or more flags).
- [ ] **Import card** with the code textarea, Import button, file chooser and error. Shown before import or through "Replace baseline".
- [ ] **Main card**: baseline info, "Pause for 1 hour" or "Resume now", and "Open SecondLook".
- [ ] **Main card, locked**: the pause button is disabled and the locked note shows.
- [ ] **Where it runs**: built-in site toggles, custom origins, and "Also use on <host>" for the current tab.
- [ ] **Recent activity log**: entries, or "Nothing yet.". The copy button reads "Copied ✓" or "Copy failed — use Download".
- [ ] **Advanced details**: app URL, "Save address", "Replace baseline", and the error line.

## 16. Extension in-page UI (`extension/src/overlay.js`, night; styles inlined, not from style.css)

- [ ] **Second-look prompt, with plan**: bottom card, eye, reason, plan box with the note, countdown, and Edit, Send anyway, Check how I'm doing. Reach it by typing sloppily on WhatsApp Web, Instagram DMs or Gmail.
- [ ] **Second-look prompt, no plan**: shows "Book a ride home:" ride chips instead.
- [ ] **Prompt at 600px and wider**: the card floats with a bottom margin.
- [ ] **In-page toast**: "SecondLook couldn't press send for you…" or "Home address copied…".
- [ ] **Escalation hand-off**: the web app opens at `#/home?checkin=ext-ignored`, `ext-repeated` or `ext-strong` (see section 11), or at `#/check` from "Check how I'm doing".
