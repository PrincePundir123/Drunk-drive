# Protected hooks: do not rename or remove

These IDs, classes, attributes and ARIA hooks are read or written by JavaScript, the tests or the extension. A restyle can change how they look. It must not rename them, remove them, or change the DOM structure that a selector depends on, such as `.ci-actions .btn.primary` or `.timeout-bar span`.

Test files that are referenced below live in the session scratchpad:

- `e2e.js`, `night-e2e.js`, `rides-e2e.js`, `kb-e2e.js`, `study-e2e.js`, `contact-e2e.js`, `ext-e2e.js`, `axe-run.js`, `zoom-e2e.js`

The unit tests are in `tests/*.test.js`.

## 0. Rules the restyle must keep

| Rule | Why | Used by |
|---|---|---|
| `[hidden] { display: none !important; }` stays in style.css and popup.css | JS shows and hides views, steps, nav, the check-in root and field groups with the `hidden` attribute. A `display:` rule on a component would otherwise un-hide it. | app.js, study.js, popup.js, every e2e |
| `[data-boot="app"] [data-view="welcome"], [data-boot="app"] #bar-cta { display:none }` | Hides the landing page before first paint for returning users | index.html inline script, app.js (removes `data-boot`) |
| `body.no-scroll { overflow:hidden }` | Locks the page while the check-in is up. Sonar reads the class too. | app.js, sonar.js |
| `.toast.show` makes the toast visible | The toast is always in the DOM. Only `.show` reveals it. | app.js, study.js, rides-e2e (`#toast.show`) |
| `.phone-sheet.up` reveals the sheet | Landing animation | app.js |
| `.settle` / `.settle.in` / `.w` / `.ch` / `.ch.b` / `--dy` custom property | Headline settle animation. JS builds the spans and sets `--dy` and `transition-delay`. | pixel.js |
| `.trk-hint.hide` hides the hint | Tracking task | tests.js |
| `.sr-only` is a visually-hidden utility (and `.sr` in popup and overlay) | JS inserts `.sr-only` h1s, labels and live regions | app.js, pixel.js, tests.js, study.js, popup.html, overlay.js |
| `canvas.sonar` and `canvas[data-pixel]` get their draw colour from CSS `color` | `getComputedStyle(canvas).color` is the ink. If you remove `color` from these rules, the art turns black or vanishes. | sonar.js, pixel.js |
| Sonar re-reads its colour when `class`, `style`, `data-mode` or `data-theme` change on `<html>` or `<body>` | Mode switch recolours the background | sonar.js |
| Night/day theming is keyed on `[data-mode="day"]` and `[data-mode="night"]` in tokens.css. It works on any element, not only body. | JS sets `data-mode` on body, modal backdrops, the check-in overlay and the lock band | app.js, tokens.css |
| `css/tokens.css` must be byte-identical to `extension/lib/tokens.css`, and the three fonts must match their copies in `extension/assets/fonts/` | After editing tokens, run `npm run build:ext`, or `tests/extension.test.js` fails | scripts/sync-extension.js, tests/extension.test.js |
| `extension/src/overlay.js` hard-codes Night Mode colours in its inline CSS | It can't load style.css inside a closed shadow root. If night tokens change, update it by hand. | overlay.js |
| Focus ring: every focusable element must compute `outline-style` other than `none` with `outline-width` of at least 2px when focused | `kb-e2e.js` fails otherwise | kb-e2e.js |
| No horizontal scroll at 320, 360 and 640px, and no `button`, `a.btn` or `.btn` whose right edge goes past the viewport | Asserted | zoom-e2e.js, kb-e2e.js, e2e.js, night-e2e.js, study-e2e.js |
| The primary check-in action `.ci-actions .btn.primary` must be scrollable into view at 640x400 | Asserted | zoom-e2e.js |
| The first `h1` in each `[data-view]` section gets `tabindex=-1` and focus on route change. Chat uses an `.sr-only` h1. | Focus management. Keep exactly one h1 per view. | app.js, study.js (`focusH1`) |
| The tracking canvas draws with hard-coded colours (`#7B7BFF`, `#F5F5F7`, `rgba(...)`) | Not themeable by CSS. Change these in tests.js if needed. | tests.js |

---

## 1. index.html (static markup)

| Hook | Type | Used by |
|---|---|---|
| `data-boot` on `<html>` (value `app`) | data-attr | index.html inline script, app.js, style.css |
| `data-mode` on `<body>` (`day`/`night`) | data-attr (state) | app.js, tokens.css, sonar.js |
| `meta[name="theme-color"]` content | attr (state) | app.js (sets `#0A0A0F` or `#F2F2F2`) |
| `#app` | id | skip link target, `main#app` |
| `.skip` | class | skip link (keyboard) |
| `#topnav` | id | app.js (hidden toggle), e2e.js (`#topnav a[href="#/chat"]` etc.) |
| `#tabbar` | id | app.js (hidden toggle), e2e.js (`isHidden`/`isVisible`) |
| `#topnav a`, `#tabbar a` with `href="#/home"`, `#/chat`, `#/check`, `#/log`, `#/settings` | href | app.js (matches href to set aria-current), e2e.js |
| `aria-current="page"` on nav links | aria (state) | app.js, style.css |
| `#demo-badge` | id | app.js (hidden toggle), e2e.js |
| `#demo-exit` | id | app.js |
| `#bar-cta` | id | app.js (hidden toggle), style.css |
| `[data-demo]` | data-attr | app.js (binds loadDemo to all 3 buttons) |
| `#try-demo` | id | e2e.js, night-e2e.js, rides-e2e.js, contact-e2e.js, ext-e2e.js, axe-run.js, zoom-e2e.js |
| `[data-go="setup"]` | data-attr | app.js, e2e.js (`[data-view="welcome"] [data-go="setup"]`) |
| `[data-view]` on the 8 sections (`welcome`, `setup`, `calibrate`, `home`, `chat`, `check`, `log`, `settings`) | data-attr + `hidden` | app.js (routing), e2e.js, kb-e2e.js, axe-run.js (`[data-view="x"]:not([hidden])`) |
| `[data-settle]` | data-attr | pixel.js (settleAll) |
| `data-settled` | data-attr (state) | pixel.js |
| `canvas[data-pixel]` (`hero`, `corner`, `cta`) | data-attr | pixel.js (layout key) |
| `.pixel-art` | class | canvas colour via CSS `color` |
| `.phone` | class | app.js (renderWelcome exits early if missing) |
| `#pc-text` | id | app.js |
| `#pc-quote` | id | app.js |
| `.phone-sheet` + `.up` | class (state) | app.js, style.css |
| `.replay` + `hidden` | class (state) | app.js |
| `#eyeclip-demo` | id | internal SVG `clip-path` reference |
| `#why-title`, `#how-title`, `#modes-title`, `#promise-title`, `#cta-title` | id | `aria-labelledby` targets |
| `data-mode="night"` / `"day"` on `.record`, `.mode`, `.promise-card`, `.cta-end` | data-attr | tokens.css theming |
| `#checkin-root` + `hidden` | id | app.js, e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js, ext-e2e.js, contact-e2e.js |
| `#modal-root` | id | app.js (modal mount) |
| `#toast` (`role="status"`, `aria-live`) + `.show` | id / class (state) | app.js, rides-e2e.js |
| `body.has-tabbar` | class (state) | app.js, style.css |

## 2. app.js: generated markup, by screen

### Shared and routing

| Hook | Type | Used by |
|---|---|---|
| `h1` inside each view (receives `tabindex=-1` and focus) | element | app.js |
| `.modal-backdrop` (+ `.sheet-backdrop`) | class | app.js (click on backdrop closes), style.css |
| `data-mode="night"` on `.modal-backdrop` | data-attr (state) | app.js |
| `.modal` (+ `.sheet`, `.rise`) with `role="dialog" aria-modal="true" aria-label` | class / aria | app.js, e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js, axe-run.js, zoom-e2e.js (`.modal` count, `.modal .nudge` etc.) |
| `.sheet-grip` | class | visual only (aria-hidden) |
| `[autofocus]` in modals | attr | app.js (picks initial focus), rides-e2e.js (Cancel focused) |
| `[data-close]` | data-attr | app.js (every modal Cancel/Close), night-e2e.js, rides-e2e.js |
| `[data-log]`, `[data-log-type]` | data-attr | app.js (global click logger) |
| `[data-ride-id]`, `[data-ride-src]` | data-attr | app.js (global ride click), night-e2e.js, rides-e2e.js (`a.ride[data-ride-id="uber"]`, `#checkin-root a[data-ride-id="uber"]`) |
| `.eye` svg + `data-level` (`ok`/`caution`/`high`/`count`) | class / data-attr | icons.js, style.css (`--eye-color`) |
| `.eye-iris` | class | icons.js `setProgress` (countdown ring) |
| `.eye-shape`, `.eye-track`, `.eye-pupil`, `.eye-bar`, `.eye-lid`, `.eye-outline` | class | icons.js markup, style.css, overlay.js inline CSS |
| `.done-mark` | class | icons.js className (calibrate done, study finish) |
| `.ico`, `svg.i` | class | icons.js output everywhere |
| `.form-error` (`role="alert"`) | class / aria | app.js (`$('.form-error', form)` in setup, settings and night form), e2e.js (`#setup-form .form-error`), study.js |
| `.stepper-bar` `role="progressbar"` `aria-valuenow/min/max` | aria | app.js |

### Setup (`#/setup`)

| Hook | Type | Used by |
|---|---|---|
| `[data-stepper]` | data-attr | app.js |
| `#setup-title` | id | app.js, e2e.js |
| `#setup-lead` | id | app.js |
| `#setup-form` | id | app.js, e2e.js, axe-run.js |
| `fieldset[data-step="1..4"]` + `hidden` | data-attr (state) | app.js |
| `[data-back]` + `hidden` | data-attr | app.js |
| `[data-next]` | data-attr | app.js, e2e.js, axe-run.js |
| Field names: `name`, `myPhone`, `contactName`, `contactPhone`, `homeAddress`, `notifyOnTimeout`, `shareLocation`, `transparency`, `sober` | name attr | app.js (FormData, `form.elements.homeAddress`), e2e.js, rides-e2e.js |

### Calibrate, check and task widgets (tests.js)

| Hook | Type | Used by |
|---|---|---|
| `#calib-start` | id | app.js, e2e.js, axe-run.js |
| `.task-host` | class | app.js, study.js |
| `.rt-pad` | class | tests.js, e2e.js, kb-e2e.js, study-e2e.js, axe-run.js |
| `data-state` on `.rt-pad` (`idle`/`wait`/`go`/`early`/`result`/`done`) | data-attr (state) | tests.js, style.css, e2e.js, kb-e2e.js, study-e2e.js, axe-run.js |
| `.rt-msg`, `.rt-sub` | class | tests.js |
| `.rt-dots i` + `.on` | class (state) | tests.js, style.css |
| `.trk-canvas` (queried as `canvas`) | class | tests.js, e2e.js, axe-run.js |
| `.trk-hint` + `.hide` | class (state) | tests.js |
| `.trk-timer span` | class | tests.js (width) |
| `.trk-skip` | class | tests.js, e2e.js, study-e2e.js, axe-run.js |
| `.linkish` | class | style on trk-skip, exit-demo, contact copy |
| `.tt-input` / `#tt-input` | class / id | tests.js, e2e.js, study-e2e.js, axe-run.js (label `for`) |
| `.tt-target` | class | e2e.js, study-e2e.js (reads the sentence to type) |
| `.tt-next` (+ `disabled`) | class | tests.js |
| `.tt-hint` | class | tests.js |
| `.tt-step`, `.tt-row` | class | markup |
| `#check-start` | id | app.js, e2e.js, axe-run.js |
| `#check-sim` | id | app.js, e2e.js, axe-run.js |
| `#again` | id | app.js |
| `.result` + `data-level` | class / data-attr | e2e.js (`.result[data-level="high"]`, `.result .gauge`), axe-run.js |
| `.gauge` and `.gauge span` (score text), `role="img"` | class / aria | e2e.js (reads the score from `.gauge span`) |
| `.bars li`, `.bar span.ok/.caution/.high` | class (state) | e2e.js (count), style.css |
| `div[data-level="ok"]` wrapper around done-mark | data-attr | app.js, study.js |

### Home (`#/home`)

| Hook | Type | Used by |
|---|---|---|
| `[data-act]`: `ride`, `exit-demo`, `own-baseline`, `contact-view`, `night-start`, `home-safe`, `night-demo-remind` | data-attr | app.js (delegated click), e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js, axe-run.js |
| `.status` (on `.status-hero`) | class (**hook-only; no CSS rule**) | e2e.js, night-e2e.js, axe-run.js, zoom-e2e.js |
| `.status-hero[data-level]`, `aria-live="polite"` | class / data-attr | style.css, app.js |
| `.demo-card` (on `.demo-bar`) | class (**hook-only**) | e2e.js, kb-e2e.js |
| `.night-card` | class | night-e2e.js, kb-e2e.js |
| `.night` (on `.night-card`) | class (hook-only) | nothing queries it today; keep it |
| `.plan-card` (+ `.compact`) | class | night-e2e.js (`#checkin-root .plan-card`, `.modal .nudge .plan-card`) |
| `.note-to-self` | class | markup |
| `details.more` `[open]` | attr (state) | app.js (open when flagged), style.css |
| `.action` / `.action.primary` | class (state) | app.js (primary moves between actions) |

### Messages (`#/chat`)

| Hook | Type | Used by |
|---|---|---|
| `#composer` | id | app.js, e2e.js, kb-e2e.js, axe-run.js |
| `.composer` (form) | class | app.js |
| `.chat-log` `role="log"` `aria-live` | class / aria | app.js |
| `.msg.me` / `.msg.them` | class | app.js, e2e.js, kb-e2e.js (count of `.msg.me`) |
| `#simulate` (+ `disabled`) | id | app.js, e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js, contact-e2e.js, axe-run.js, zoom-e2e.js |
| `.send` button `aria-label="Send message"` | aria | a11y |

### Second-look nudge and Night Out reminder (modals)

| Hook | Type | Used by |
|---|---|---|
| `.nudge` | class | e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js, contact-e2e.js, axe-run.js, zoom-e2e.js (`.modal .nudge`) |
| `[data-n]`: `edit`, `send`, `check` | data-attr | app.js, e2e.js, night-e2e.js, rides-e2e.js, zoom-e2e.js |
| `[data-secs]` | data-attr | app.js (countdown number) |
| `.timeout-bar span` | class | app.js (width) |
| `[data-live]` | data-attr | app.js (spoken countdown) |
| `[data-r]`: `ok`, `home` | data-attr | app.js, night-e2e.js, axe-run.js |

### Check-in overlay (`#checkin-root`)

| Hook | Type | Used by |
|---|---|---|
| `.checkin` `data-mode="night"` `role="alertdialog"` `aria-modal` `aria-labelledby="ci-title"` | class / aria | app.js |
| `.ci-screen`, `.ci-top`, `.ci-main` | class | markup |
| `.ci-actions` | class | e2e.js and zoom-e2e.js (`.ci-actions .btn.primary`) |
| `.ci-ring` `role="timer"` + `data-level="count"` | class / aria | app.js (tick), e2e.js, night-e2e.js, rides-e2e.js, kb-e2e.js (`[role="timer"]`), contact-e2e.js, ext-e2e.js, axe-run.js, zoom-e2e.js |
| `#ci-secs` | id | app.js |
| `#ci-title` | id | app.js (focus), kb-e2e.js (`activeElement.id === 'ci-title'`) |
| `#ci-live` `aria-live="assertive"` + `data-said` | id / aria / data-attr | app.js, kb-e2e.js (`#ci-live[aria-live]`) |
| `.ci-replies` `aria-live` | class | app.js (`#checkin-root .ci-replies`) |
| `.reply-banner` | class | contact-e2e.js |
| `.ci-test` | class | app.js (reaction mount), e2e.js, kb-e2e.js, axe-run.js |
| `.ci-icon[data-level]`, `.ci-consent`, `.ci-note`, `.ci-reason` | class | markup (`.ci-note` also used in study.js) |
| `.alert-text` | class | e2e.js, contact-e2e.js, axe-run.js |
| `[data-ci]`: `prove`, `back`, `ride`, `ride-plan`, `call`, `text`, `send-sms`, `send-wa`, `close`, `thanks`, `112` | data-attr | app.js (delegated), e2e.js, night-e2e.js, rides-e2e.js, contact-e2e.js, axe-run.js |
| `.e112` with `aria-label="Emergency: call 112"` | class / aria | style.css |
| `#e-yes` | id | app.js (112 confirm) |
| `a[href="tel:112"]` only inside the confirm | href | rides-e2e.js, contact-e2e.js |
| `.help-inline` | class | markup (also contact page) |

### Get home safe (help) markup

| Hook | Type | Used by |
|---|---|---|
| `.help`, `.rides` | class | e2e.js (`.modal .rides`) |
| `a.ride` | class | e2e.js, rides-e2e.js (`.modal a.ride[data-ride-id=...]`) |
| `.ride-hint` | class | rides-e2e.js |
| `.contact-actions` | class | markup |

### Log (`#/log`)

| Hook | Type | Used by |
|---|---|---|
| `#log-dl`, `#log-import`, `#log-clear` | id | app.js; `#log-import` also ext-e2e.js |
| `ol.log` and `.log li` | class | e2e.js, night-e2e.js, rides-e2e.js, contact-e2e.js, ext-e2e.js, axe-run.js |
| `li[data-type]` | data-attr | style.css (icon colours) |
| `.log-night`, `.log-ico`, `time[datetime]` | class | markup |
| `#log-code`, `#log-import-go`, `#log-file`, `#log-import-err` | id | app.js; `#log-code` and `#log-import-go` also ext-e2e.js |
| `.file-btn` | class | label wrapping the file input |

### Settings (`#/settings`)

| Hook | Type | Used by |
|---|---|---|
| `.lock` (on `.lock-band`) | class (**hook-only**) | e2e.js, axe-run.js |
| `.lock-band` `data-mode="night"` `role="status"` | class / aria | style.css |
| `#unlock` | id | app.js, e2e.js, kb-e2e.js |
| `.locked-tag` | class | markup |
| `[data-jump]` → section ids `set-you`, `set-rides`, `set-alerts`, `set-ext`, `set-baseline`, `set-data` | data-attr / id | app.js |
| `#settings-form` + `fieldset.plain[disabled]` | id / attr (state) | app.js, e2e.js, rides-e2e.js, axe-run.js |
| Field names `sensitivity`, `nudgeTimeout`, `checkinTimeout` (plus the profile names above) | name attr | app.js, e2e.js |
| `#home-here`, `#home-clear`, `#home-err` | id | app.js, rides-e2e.js |
| `#link-create`, `#link-url`, `#link-copy`, `#link-wa`, `#link-sms`, `#link-test`, `#link-preview`, `#link-reset`, `#link-off` | id | app.js; `#link-create`, `#link-url` and `#link-test` also e2e.js, contact-e2e.js, axe-run.js |
| `.qr svg` (`role="img"` with `aria-label`) | class / aria | contact-e2e.js, qr.js, tests/secure.test.js |
| `#ext-export`, `#ext-code-wrap` (+`hidden`), `#ext-code`, `#ext-copy`, `#ext-dl` | id | app.js; `#ext-export` and `#ext-code` also ext-e2e.js |
| `#recal` | id | app.js |
| `#reset` (+ `disabled`) | id | app.js, e2e.js (`#reset:not([disabled])`) |
| `disabled` on `#recal`, `#reset`, `#home-here`, `#home-clear`, `#link-create`, `#link-reset`, `#link-off`, `#ext-export`, `#link-test` | attr (state) | app.js |

### Unlock and prove modals

| Hook | Type | Used by |
|---|---|---|
| `.unlock-test` | class | app.js (reaction mount) |
| `#unlock-msg` | id | app.js |

### Night Out form and modals

| Hook | Type | Used by |
|---|---|---|
| `#night-form` | id | app.js, night-e2e.js, kb-e2e.js, axe-run.js |
| `[data-show="cab"]`, `[data-show="friend"]` + `hidden` | data-attr (state) | app.js, night-e2e.js |
| Field names `mode` (radio `cab`/`friend`/`walk`/`stay`), `provider`, `friend`, `homeBy`, `everyMin`, `note`, `ntfy` | name attr | app.js, night-e2e.js (`input[name=mode][value=friend]`, `input[name=homeBy]`, `textarea[name=note]`) |
| `code.topic` | class | markup |

## 3. contact.html and js/contact.js

| Hook | Type | Used by |
|---|---|---|
| `body.contact-page` `data-mode="night"` | class / data-attr | style.css, tokens.css |
| `#conn` + class `conn connecting/open/reconnecting/offline` | id / class (state) | contact.js (sets `className`), contact-e2e.js (`#conn.open`, `#conn.offline`) |
| `#banner` (`role="status"`) and `.warn` inside | id / class | contact.js, contact-e2e.js (`#banner .warn`) |
| `#live` (`aria-live="assertive"`) | id | contact.js |
| `#content` | id | contact.js, contact-e2e.js, axe-run.js (`#content h1`) |
| `h1` | element | contact-e2e.js |
| `.alert-card` + `.test` / `.urgent` | class (state) | contact-e2e.js, style.css |
| `[data-reply]`: `calling`, `on_my_way`, `booking_cab` | data-attr | contact.js, contact-e2e.js |
| `[data-ride]` on `a.ride` | data-attr | contact.js, contact-e2e.js (`.help-inline a.ride`) |
| `.help-inline .rides` | class | contact-e2e.js |
| `.sent` (`role="status"`) | class | contact-e2e.js |
| `.updates li` | class | contact-e2e.js |
| `[data-e]`: `ask`, `cancel`, `call` | data-attr | contact.js, contact-e2e.js |
| `[data-copy-topic]` | data-attr | contact.js |
| `.panel`, `.steps-list`, `details.more.explainer` | class | markup |

## 4. study.html and js/study.js

| Hook | Type | Used by |
|---|---|---|
| `#study` (`aria-live="polite"`) | id | study.js root, study-e2e.js |
| `#toast` + `.show` | id / class | study.js |
| `#resume`, `#restart` | id | study.js |
| `#start` (form) and its `.form-error` | id / class | study.js, study-e2e.js, axe-run.js |
| Field names `code`, `sober`, `ok`, `tired` | name attr | study.js, study-e2e.js |
| `#cont`, `#cont-err` | id | study.js |
| `#go` | id | study.js, study-e2e.js |
| `#self` (form, `select[name=tired]`) and `#self .form-error` | id | study.js |
| `#free`, `#free-next` | id | study.js, study-e2e.js |
| `#dl`, `#new` | id | study.js, study-e2e.js |
| `.task-host`, `.rt-pad`, `.trk-skip`, `.tt-input`, `.tt-target` | class | study.js, study-e2e.js (see tests.js above) |

## 5. Extension popup (popup.html and popup.js)

| Hook | Type | Used by |
|---|---|---|
| `body[data-mode="day"]` | data-attr | lib/tokens.css |
| `#status` + class `status` / `status off` / `status caution` / `status high` | id / class (state) | popup.js (sets `className`), popup.css |
| `.dot` | class | popup.css |
| `#status-title`, `#status-text` | id | popup.js, ext-e2e.js |
| `#import-card` + `hidden` | id | popup.js, ext-e2e.js (`#import-card:not([hidden])`) |
| `#import-code`, `#import-btn`, `#import-file`, `#import-error` | id | popup.js, ext-e2e.js |
| `#main-card` + `hidden` | id | popup.js, ext-e2e.js |
| `#baseline-info`, `#pause-note`, `#open-app` | id | popup.js; `#baseline-info` also ext-e2e.js |
| `#pause-btn` (+ `disabled`) | id | popup.js, ext-e2e.js |
| `#sites` (change delegation) | id | popup.js |
| `input[data-site]` (`whatsapp`/`instagram`/`gmail`), `input[data-origin]` | data-attr | popup.js, ext-e2e.js (`input[data-site="whatsapp"]`) |
| `.site` | class | popup.css |
| `#log` (`ol.log`) | id | popup.js, ext-e2e.js |
| `#copy-log`, `#dl-log` | id | popup.js |
| `#advanced`, `#app-url`, `#save-url`, `#replace-baseline`, `#adv-error` | id | popup.js |
| `.sr`, `.file`, `.error`, `.card`, `.row` | class | popup.css |
| `CONTENT_FILES` array in popup.js | code | must equal the manifest `content_scripts[0].js` (tests/extension.test.js) |

## 6. Extension in-page overlay (extension/src/overlay.js)

This UI is styled only by the inline CSS string in overlay.js, not by style.css.

| Hook | Type | Used by |
|---|---|---|
| `<secondlook-overlay>` custom element (closed shadow root) | element | overlay.js, ext-e2e.js (`document.querySelector('secondlook-overlay')`) |
| `.backdrop`, `.card` (`role="dialog"` `aria-modal` `aria-labelledby="t"` `aria-describedby="d"`) | class / aria | overlay.js |
| `#t`, `#d` | id | overlay.js (inside the shadow root) |
| `[data-a]`: `edit`, `send`, `check` | data-attr | overlay.js |
| `[data-ride]` (index) on `a.btn` | data-attr | overlay.js |
| `[data-secs]`, `[data-live]`, `.bar span` | data-attr / class | overlay.js (countdown) |
| `button.primary` (initial focus), `button`, `a.btn` (focus trap list) | class | overlay.js |
| `.grip`, `.brand`, `.eye*`, `.plan`, `.rides`, `.count`, `.stack`, `.quiet`, `.sr`, `.toast` | class | overlay.js inline CSS |

Third-party selectors in `extension/src/selectors.js` (WhatsApp, Instagram and Gmail composers and send buttons) target other sites. A SecondLook restyle does not affect them.

## 7. Hooks that depend on text (copy)

Tests find these elements by visible text. Rewording them breaks tests, even though they are not CSS hooks.

| Text | Used by |
|---|---|
| "Baseline saved", "Go to my dashboard", "Good call" | e2e.js |
| "safe contact" in `#setup-title`; "phone" and "confirm" in the setup error | e2e.js |
| "Night Out active – home by", "You planned to take an Uber home. Here it is →", "(protective)", "ride home with Priya", "Text Priya", "Quick check before ending Night Out", "You missed a Night Out check-in", "haven’t tapped “Home safe” yet" | night-e2e.js |
| "Add your home address" (ride hint), "add your home address" and "Home address copied" (toast), "✓" on prefilled rides, "Cancel" button text | rides-e2e.js |
| Tab-order text: "Try the 2-minute demo", "Going out tonight", "Start my Night Out", "Messages", "Simulate an impaired message", "Edit my message", "15-second test", "Tap here to start", "Book a ride home" or "like you planned", "Close", "Settings", "Unlock with a 15-second test" | kb-e2e.js |
| "We let Priya know", "Priya is on the way – ", "booking you a cab", "Sent ✓", "Thanks, I’m staying put", "Alex sent a test", "Alex may need help", "private link", "couldn’t be unlocked", "offline", "safe contact" (contact h1) | contact-e2e.js |
| "Not set up", "All quiet", "Paused until", "looked off" or "don’t drive", "browser extension" (check-in reason), "[Extension]" | ext-e2e.js |
| Log phrases ("You started Night Out", "Opened Uber", "Encrypted alert delivered to Priya", and others) | night-e2e.js, rides-e2e.js, contact-e2e.js, ext-e2e.js |

## 8. Fragile hooks (tests use classes that look purely visual)

| Hook | Risk |
|---|---|
| `.ci-actions .btn.primary` | e2e.js and zoom-e2e.js need the check-in's primary action to carry the button *variant* class `.btn.primary`. If the restyle renames the variant (to `.btn-primary`, for example) or wraps the button in another element, both tests break. |
| `.status` on the home hero | No CSS uses it; it exists only for tests. It is easy to drop as dead CSS. The popup also has a `.status`. |
| `.lock` on the lock band | Hook-only (CSS uses `.lock-band`). It is easy to drop. |
| `.demo-card` on the demo bar | Hook-only (CSS uses `.demo-bar`). |
| `.gauge span` | The test reads the score from the *first* span in `.gauge`. Adding a decorative span before it breaks the test. |
| `.modal`, `.nudge`, `.night-card`, `.plan-card`, `.result`, `.bars li`, `.msg.me`, `.log li`, `.alert-text`, `.reply-banner`, `.ride-hint`, `.rides`, `a.ride`, `.qr svg` | These are visual component classes that tests also use as selectors. Keep the names even if the look changes completely. |
| `.alert-card.test` / `.urgent`, `.sent`, `.updates li`, `.help-inline`, `#banner .warn` | Contact-page component classes used by contact-e2e.js. |
| `.rt-pad`, `.trk-canvas`, `.trk-skip`, `.tt-input`, `.tt-target` | Task widget classes used by 4 test scripts and by study.js. |
| `button, a.btn, .btn` (zoom clip check) and the outline check (kb-e2e) | Any new button style must keep the `.btn` class and a focus outline of at least 2px. A box-shadow-only focus ring fails kb-e2e. |
