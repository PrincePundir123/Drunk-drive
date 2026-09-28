/* SecondLook — app controller.
 * Views: welcome → setup (while sober) → calibrate (baseline) → home / messages / check / log / settings.
 * Escalation: message nudge → check-in overlay → (if you agreed in advance) alert your safe contact. */
(function () {
  'use strict';

  var M = window.SLMetrics;
  var T = window.SLTests;
  var S = window.SLStore;
  var SH = window.SLShare;
  var SEC = window.SLSecure;
  var RL = window.SLRelay;
  var NO = window.SLNight;
  var R = window.SLRides;
  var DICT = new Set(String(window.SL_WORDS || '').split(/\s+/).filter(Boolean));

  var HOUR = 3600e3;
  var LOCK_WINDOW = 6 * HOUR;        // settings stay locked this long after a flag
  var UNLOCK_WINDOW = 15 * 60e3;     // passing a check unlocks settings for this long
  var SENSITIVITY = { gentle: 65, balanced: 55, protective: 45 };
  var DEFAULT_SETTINGS = { nudgeTimeout: 45, checkinTimeout: 60, sensitivity: 'balanced' };
  var VIEWS = ['welcome', 'setup', 'calibrate', 'home', 'chat', 'check', 'log', 'settings'];

  // ======================================================================
  // helpers
  // ======================================================================
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function fmtDate(ts) { return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
  function ago(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function phoneClean(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function validPhone(p) { var d = String(p || '').replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; }
  function greeting() { var h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  // ======================================================================
  // data
  // ======================================================================
  function getProfile() {
    var p = S.get('profile', null);
    if (!p) return null;
    p.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings || {});
    p.contact = Object.assign({ name: '', phone: '' }, p.contact || {});
    p.consent = Object.assign({ notifyOnTimeout: false, shareLocation: false, agreedAt: p.createdAt || Date.now() }, p.consent || {});
    return p;
  }
  function saveProfile(p) { S.set('profile', p); }
  function getBaseline() { return S.get('baseline', null); }
  function saveBaseline(b) { S.set('baseline', b); }
  function getState() { return Object.assign({ flags: [], lastCheck: null, checkin: null, unlockedAt: 0 }, S.get('state', {})); }
  function saveState(st) { S.set('state', st); }
  // Privacy: practice-chat messages live in memory only and vanish on reload.
  var chatMemory = [];
  function getChat() { return chatMemory.slice(); }
  function saveChat(c) { chatMemory = c.slice(-80); }

  // ---------- Night Out ----------
  function getNight() { var n = getState().nightOut; return NO.isActive(n, Date.now()) ? n : null; }
  function sensitivityNow(p) { var s = p.settings.sensitivity; return getNight() ? NO.bumpSensitivity(s) : s; }

  /** "You planned to take an Uber home. Here it is →" + one-tap button + note to self. */
  function planHtml(p, n, src) {
    if (!n) return '';
    var ride = n.plan.mode === 'cab' ? R.rideById(n.plan.provider, { address: p.homeAddress, home: p.home }) : null;
    var text = NO.planText(n.plan, p.contact.name);
    var friendSms = n.plan.mode === 'friend' && n.plan.friendIsContact
      ? '<a class="btn secondary" href="' + esc(smsLink(p.contact.phone, askForRideText(p))) + '" data-log-type="contact" data-log="Texted ' + esc(p.contact.name) + ' for the ride you planned">💬 Text ' + esc(p.contact.name) + '</a>' : '';
    return '<div class="plan-card"><p class="plan-title">🌙 ' + esc(text) + (ride ? ' Here it is →' : '') + '</p>' +
      (ride || friendSms ? '<div class="row-btns">' +
        (ride ? '<a class="btn primary" href="' + esc(ride.url) + '" target="_blank" rel="noopener" data-ride-id="' + ride.id + '" data-ride-src="' + esc(src || 'your Night Out plan') + '">Open ' + esc(ride.name) + '</a>' : '') +
        friendSms + '</div>' : '') +
      (n.note ? '<blockquote class="note-to-self">“' + esc(n.note) + '”<span>— you, earlier tonight</span></blockquote>' : '') +
      '</div>';
  }

  function log(type, text) {
    var l = S.get('log', []);
    l.unshift({ at: Date.now(), type: type, text: text });
    S.set('log', l.slice(0, 400));
    if (currentView === 'log') renderView();
  }

  function addFlag(source, score) {
    var st = getState();
    st.flags = st.flags.filter(function (f) { return Date.now() - f.at < 12 * HOUR; });
    st.flags.push({ at: Date.now(), source: source, score: score });
    saveState(st);
  }
  function recentFlags(ms) { return getState().flags.filter(function (f) { return Date.now() - f.at < ms; }); }
  function isLocked() {
    var st = getState();
    if (st.checkin) return true;
    if (st.unlockedAt && Date.now() - st.unlockedAt < UNLOCK_WINDOW) return false;
    return recentFlags(LOCK_WINDOW).length > 0;
  }

  // ======================================================================
  // links: rides and your safe contact
  // ======================================================================
  // All ride / call / message links come from js/rides.js (shared with the contact view and extension).
  function smsLink(phone, body) { return R.smsUrl(phone, body); }
  function waLink(phone, body) { return R.waUrl(phone, body); }
  function telLink(phone) { return R.telUrl(phone); }
  function askForRideText(p) {
    return 'Hey ' + p.contact.name + ", I've been drinking and I don't think I should drive. Could you help me get home?";
  }
  function helpHtml(p) {
    var rides = R.rideOptions({ address: p.homeAddress, home: p.home }).map(function (r) {
      return '<a class="ride" href="' + esc(r.url) + '" target="_blank" rel="noopener" data-ride-id="' + r.id + '">' + esc(r.name) + (r.prefilled ? ' ✓' : '') + '</a>';
    }).join('');
    var hint = p.home && R.hasCoords(p.home) ? 'Uber opens with your home filled in (✓). For the others we copy your address — paste it as the destination.'
      : p.homeAddress ? 'We’ll copy your home address when you open a ride app — paste it as the destination.'
      : 'Add your home address in Settings for one-tap rides.';
    var ask = askForRideText(p);
    return '<div class="help">' +
      '<h3>Get a ride</h3><div class="rides">' + rides + '</div><p class="small muted ride-hint">' + esc(hint) + '</p>' +
      '<h3>Or ask ' + esc(p.contact.name) + '</h3>' +
      '<div class="contact-actions">' +
        '<a class="btn secondary" href="' + esc(smsLink(p.contact.phone, ask)) + '" data-log-type="contact" data-log="Texted ' + esc(p.contact.name) + ' for a ride">💬 Text</a>' +
        '<a class="btn secondary" href="' + esc(waLink(p.contact.phone, ask)) + '" target="_blank" rel="noopener" data-log-type="contact" data-log="Messaged ' + esc(p.contact.name) + ' on WhatsApp">WhatsApp</a>' +
        '<a class="btn secondary" href="' + esc(telLink(p.contact.phone)) + '" data-log-type="contact" data-log="Called ' + esc(p.contact.name) + '">📞 Call</a>' +
      '</div></div>';
  }
  /** One-tap ride: the link opens normally; we copy the address when the link can't carry it, and log it. */
  function onRideClick(id, src) {
    var p = getProfile();
    if (!p) return;
    var opt = R.rideById(id, { address: p.homeAddress, home: p.home });
    if (!opt) return;
    log('ride', 'Opened ' + opt.name + ' to get a ride home' + (src ? ' (from ' + src + ')' : '') + (opt.prefilled ? ', with your home location filled in.' : '.'));
    if (opt.copyAddress && p.homeAddress) {
      R.copyText(p.homeAddress).then(function (ok) { if (ok) toast('Home address copied – paste it as destination'); });
    } else if (!p.homeAddress && id !== 'taxi') {
      toast('Tip: add your home address in Settings for one-tap rides');
    }
  }

  function openHelp() {
    var p = getProfile();
    if (!p) return;
    var m = openModal('<h2>Get home safe 💙</h2><p class="muted">Leaving the car is always the right call.</p>' + helpHtml(p) +
      '<button type="button" class="btn ghost full" data-close>Close</button>', { label: 'Get home safe' });
    $('[data-close]', m.el).addEventListener('click', function () { m.close('close'); });
  }

  // ======================================================================
  // modal
  // ======================================================================
  var activeModal = null;
  function openModal(html, opts) {
    opts = opts || {};
    closeModal('replaced');
    $('#toast').classList.remove('show'); // never cover a dialog
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.label || 'Dialog') + '">' + html + '</div>';
    $('#modal-root').appendChild(wrap);
    var prevFocus = document.activeElement;
    var dismissible = opts.dismissible !== false;
    var modal = {
      el: wrap.firstElementChild,
      close: function (reason) {
        if (activeModal !== modal) return;
        activeModal = null;
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        if (opts.onClose) opts.onClose(reason);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      }
    };
    function onKey(e) { if (e.key === 'Escape' && dismissible) modal.close('escape'); }
    document.addEventListener('keydown', onKey);
    if (dismissible) wrap.addEventListener('click', function (e) { if (e.target === wrap) modal.close('backdrop'); });
    activeModal = modal;
    // [autofocus] wins; otherwise the first focusable element.
    var first = modal.el.querySelector('[autofocus]') || modal.el.querySelector('button, [href], input, textarea, select');
    if (first) setTimeout(function () { if (document.contains(first)) first.focus(); }, 30);
    return modal;
  }
  function closeModal(reason) { if (activeModal) activeModal.close(reason || 'closed'); }

  // ======================================================================
  // router
  // ======================================================================
  var currentView = null, viewCleanup = null;
  function go(view) {
    if (location.hash !== '#/' + view) location.hash = '#/' + view;
    else route();
  }
  function route() {
    var v = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
    var p = getProfile(), b = getBaseline();
    if (!p) { if (v !== 'setup') v = 'welcome'; }
    else if (!b) { if (['calibrate', 'settings', 'log'].indexOf(v) < 0) v = 'calibrate'; }
    else if (VIEWS.indexOf(v) < 0 || v === 'welcome' || v === 'setup') v = 'home';
    var extReason = EXT_REASONS[new URLSearchParams(location.hash.split('?')[1] || '').get('checkin')];
    if (location.hash !== '#/' + v) history.replaceState(null, '', '#/' + v);
    currentView = v;
    renderView(true);
    if (extReason && p && b) {
      log('checkin', 'The browser extension opened SecondLook to check in with you.');
      startCheckin(extReason);
    }
  }
  var EXT_REASONS = {
    'ext-ignored': 'You didn’t respond to a second-look prompt in the browser extension.',
    'ext-repeated': 'Several messages in the browser extension looked different from your usual.',
    'ext-strong': 'A message in the browser extension looked very different from your usual.'
  };
  function renderView(moveFocus) {
    if (viewCleanup) { try { viewCleanup(); } catch (e) { /* ignore */ } viewCleanup = null; }
    var v = currentView;
    var p = getProfile(), b = getBaseline();
    $$('[data-view]').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
    var appReady = !!(p && b);
    $('#tabbar').hidden = !appReady;
    document.body.classList.toggle('has-tabbar', appReady);
    $$('#tabbar a').forEach(function (a) {
      var on = a.getAttribute('href') === '#/' + v;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#demo-badge').hidden = !(p && p.demo);
    var section = $('[data-view="' + v + '"]');
    var render = RENDER[v];
    if (render) viewCleanup = render(section) || null;
    if (moveFocus) {
      window.scrollTo(0, 0);
      var h = section.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  // ======================================================================
  // profile form (setup + settings share it)
  // ======================================================================
  function profileFields(p, isSetup) {
    p = p || { name: '', contact: { name: '', phone: '' }, homeAddress: '', consent: { notifyOnTimeout: true, shareLocation: false } };
    function checked(v) { return v ? ' checked' : ''; }
    return '' +
      '<fieldset class="group"><legend>About you</legend>' +
        '<label class="field"><span>Your first name</span><input name="name" maxlength="40" autocomplete="given-name" value="' + esc(p.name) + '" required></label>' +
        '<label class="field"><span>Your phone number <em>(optional — lets your contact call you from an alert)</em></span><input name="myPhone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="' + esc(p.myPhone || '') + '"></label>' +
      '</fieldset>' +
      '<fieldset class="group"><legend>Your safe contact</legend>' +
        '<p class="hint">Someone you trust to help you get home. They only hear from SecondLook if you agree to it below.</p>' +
        '<div class="row2">' +
          '<label class="field"><span>Their name</span><input name="contactName" maxlength="40" value="' + esc(p.contact.name) + '" required></label>' +
          '<label class="field"><span>Their phone (with country code)</span><input name="contactPhone" type="tel" inputmode="tel" maxlength="20" placeholder="+91 98765 43210" value="' + esc(p.contact.phone) + '" required></label>' +
        '</div>' +
        '<label class="field"><span>Home address <em>(optional — pre-fills Uber)</em></span><input name="homeAddress" maxlength="140" autocomplete="street-address" value="' + esc(p.homeAddress) + '"></label>' +
      '</fieldset>' +
      '<fieldset class="group"><legend>What you agree to</legend>' +
        '<label class="check"><input type="checkbox" name="notifyOnTimeout"' + checked(p.consent.notifyOnTimeout) + '><span><b>Alert my safe contact</b> if SecondLook checks in with me and I don’t respond in time.</span></label>' +
        '<label class="check"><input type="checkbox" name="shareLocation"' + checked(p.consent.shareLocation) + '><span>Include my location and home address in that alert.</span></label>' +
        (isSetup ?
          '<label class="check"><input type="checkbox" name="transparency"><span>I understand SecondLook will <b>always tell me</b> what it did, and log every action where I can see it.</span></label>' +
          '<label class="check"><input type="checkbox" name="sober"><span>I’m setting this up <b>while sober</b>.</span></label>' : '') +
      '</fieldset>';
  }
  function readProfileForm(form, isSetup) {
    var fd = new FormData(form);
    function get(k) { return String(fd.get(k) || '').trim(); }
    var out = {
      name: get('name'),
      contact: { name: get('contactName'), phone: get('contactPhone') },
      homeAddress: get('homeAddress'),
      myPhone: get('myPhone'),
      consent: { notifyOnTimeout: !!fd.get('notifyOnTimeout'), shareLocation: !!fd.get('shareLocation') }
    };
    if (!out.name) return { error: 'Please add your first name.' };
    if (!out.contact.name) return { error: 'Add your safe contact’s name.' };
    if (!validPhone(out.contact.phone)) return { error: 'Add a valid phone number for your safe contact (7–15 digits, with country code).' };
    if (out.myPhone && !validPhone(out.myPhone)) return { error: 'Your own phone number looks incomplete (7–15 digits), or leave it empty.' };
    if (isSetup && !(fd.get('transparency') && fd.get('sober'))) return { error: 'Please confirm the last two statements — they’re what make SecondLook trustworthy.' };
    return { data: out };
  }

  // ======================================================================
  // view: setup
  // ======================================================================
  function renderSetup(root) {
    root.innerHTML = '<div class="container narrow">' +
      '<p class="eyebrow">Step 1 of 2 · do this while you’re sober</p>' +
      '<h1>Make the plan now, so future-you doesn’t have to.</h1>' +
      '<p class="lead">Being impaired makes it hard to judge whether you’re impaired. So you decide the rules today, with a clear head — SecondLook just keeps the promise you made to yourself.</p>' +
      '<form id="setup-form" class="card form" novalidate>' + profileFields(null, true) +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn primary big full" type="submit">Save my plan &amp; continue</button>' +
      '</form></div>';
    var form = $('#setup-form', root);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = readProfileForm(form, true);
      if (r.error) { $('.form-error', form).textContent = r.error; return; }
      var p = Object.assign(r.data, { createdAt: Date.now(), settings: Object.assign({}, DEFAULT_SETTINGS), demo: false });
      p.consent.agreedAt = Date.now();
      saveProfile(p);
      log('setup', 'You set up SecondLook. Safe contact: ' + p.contact.name + '. Auto-alert on no response: ' + (p.consent.notifyOnTimeout ? 'ON' : 'OFF') + '. Share location: ' + (p.consent.shareLocation ? 'ON' : 'OFF') + '.');
      go('calibrate');
    });
  }

  // ======================================================================
  // view: calibrate (sober baseline)
  // ======================================================================
  function buildBaseline(res, old) {
    var t = M.baselineFromTasks(res);
    var chat = old && old.chat ? old.chat : {
      ikiMs: t.ikiMs.n ? t.ikiMs : M.seeded(200, 40, 2),
      ikiCv: t.ikiCv.n ? t.ikiCv : M.seeded(0.6, 0.15, 2),
      backspaceRate: t.backspaceRate.n ? t.backspaceRate : M.seeded(0.08, 0.05, 2),
      pauseRate: M.seeded(0.5, 0.5, 3),
      oddWordRate: M.seeded(0.06, 0.05, 3)
    };
    return { createdAt: Date.now(), test: t, chat: chat, learned: (old && old.learned) || 0 };
  }

  function stepsHtml(i, steps) {
    return '<ol class="steps" aria-label="Progress">' + steps.map(function (s, j) {
      return '<li class="' + (j < i ? 'done' : j === i ? 'current' : '') + '">' + esc(s.title) + '</li>';
    }).join('') + '</ol>';
  }

  /** Shared 3-task runner used by calibration and quick check. */
  function runTasks(root, steps, onFinish) {
    var widget = null, results = {};
    function run(i) {
      if (widget) { widget.destroy(); widget = null; }
      if (i >= steps.length) { onFinish(results); return; }
      var s = steps[i];
      root.innerHTML = '<div class="container narrow">' + stepsHtml(i, steps) +
        '<h1>' + esc(s.title) + '</h1><p class="lead">' + esc(s.desc) + '</p><div class="task-host"></div></div>';
      var host = $('.task-host', root);
      var done = function (r) { results[s.key] = r; setTimeout(function () { run(i + 1); }, 250); };
      if (s.key === 'reaction') widget = T.reactionTest(host, { trials: s.trials, onDone: done });
      else if (s.key === 'tracking') widget = T.trackingTest(host, { duration: s.duration, onDone: done });
      else widget = T.typingTest(host, { sentences: s.sentences, onDone: done });
      var h = $('h1', root); h.setAttribute('tabindex', '-1');
      if (s.key !== 'typing') h.focus({ preventScroll: true });
    }
    run(0);
    return function () { if (widget) widget.destroy(); widget = null; };
  }

  function renderCalibrate(root) {
    var p = getProfile(), old = getBaseline();
    var cleanup = null;
    var steps = [
      { key: 'reaction', title: 'Reaction time', desc: 'Tap the pad the moment it turns green. 5 quick rounds.', trials: 5 },
      { key: 'tracking', title: 'Steady hand', desc: 'Press on the glowing dot and follow it with your finger or cursor for 12 seconds.', duration: 12000 },
      { key: 'typing', title: 'Typing rhythm', desc: 'Type each sentence the way you normally text. No need to be perfect — natural is what we want.', sentences: T.pickSentences(2) }
    ];
    root.innerHTML = '<div class="container narrow">' +
      '<p class="eyebrow">' + (old ? 'Recalibrate' : 'Step 2 of 2') + ' · about 2 minutes</p>' +
      '<h1>Let’s learn your sober baseline</h1>' +
      '<p class="lead">SecondLook never compares you with other people — only with <b>you</b>, on a normal day. Do this when you’re sober and rested, ' + esc(p.name) + '.</p>' +
      '<div class="card"><ul class="ticks">' +
        '<li><b>Reaction time</b> — alcohol slows how fast you respond.</li>' +
        '<li><b>Steady hand</b> — fine motor control gets shakier.</li>' +
        '<li><b>Typing rhythm</b> — more pauses, corrections and typos.</li>' +
      '</ul></div>' +
      '<button class="btn primary big full" id="calib-start">Start</button>' +
      (old ? '<a class="btn ghost full" href="#/home">Cancel</a>' : '') +
      '</div>';
    $('#calib-start', root).addEventListener('click', function () {
      cleanup = runTasks(root, steps, function (res) {
        var b = buildBaseline(res, old);
        saveBaseline(b);
        log('baseline', (old ? 'You recalibrated' : 'You created') + ' your sober baseline. Reaction ' + Math.round(b.test.reactionMs.mean) + ' ms' +
          (b.test.trackingErr.n ? ', tracking error ' + b.test.trackingErr.mean.toFixed(1) + '%' : '') + '.');
        showBaselineSummary(root, b);
      });
    });
    return function () { if (cleanup) cleanup(); };
  }

  function baselineGrid(b) {
    var items = [['reactionMs', b.test.reactionMs], ['trackingErr', b.test.trackingErr], ['ikiMs', b.test.ikiMs], ['backspaceRate', b.test.backspaceRate]];
    return '<div class="stats">' + items.map(function (it) {
      var def = M.FEATURES[it[0]], st = it[1];
      return '<div class="stat"><span>' + esc(def.label) + '</span><b>' + (st && st.n ? esc(def.fmt(st.mean)) : '—') + '</b></div>';
    }).join('') + '</div>';
  }

  function showBaselineSummary(root, b) {
    root.innerHTML = '<div class="container narrow">' +
      '<div class="done-mark" aria-hidden="true">✓</div>' +
      '<h1>Baseline saved</h1>' +
      '<p class="lead">This is you on a normal day. From now on SecondLook quietly compares against it — and keeps learning from the messages you send while sober.</p>' +
      '<div class="card">' + baselineGrid(b) + '</div>' +
      '<a class="btn primary big full" href="#/home">Go to my dashboard</a>' +
      '</div>';
    var h = $('h1', root); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  }

  // ======================================================================
  // view: home
  // ======================================================================
  function renderHome(root) {
    var p = getProfile(), b = getBaseline(), st = getState();
    var night = getNight();
    var flags = recentFlags(LOCK_WINDOW);
    var lc = st.lastCheck && Date.now() - st.lastCheck.at < 3 * HOUR ? st.lastCheck : null;
    var level = 'ok', title = 'All quiet', text = 'SecondLook is watching quietly. Your messages are compared with your sober baseline — only on this device.';
    if (flags.length || (lc && lc.level === 'caution')) {
      level = 'caution';
      title = flags.length ? flags.length + (flags.length === 1 ? ' thing looked' : ' things looked') + ' off tonight' : 'Your last check was a bit off';
      text = 'Nothing’s wrong with taking it easy. If you’ve been drinking, pick a ride or ping ' + p.contact.name + '.';
    }
    if ((lc && lc.level === 'high') || flags.length >= 3) {
      level = 'high';
      title = 'Please don’t drive tonight';
      text = 'Several signs are well outside your sober baseline. A ride home is one tap away.';
    }
    var s = p.settings;
    root.innerHTML = '<div class="container">' +
      '<p class="eyebrow">' + greeting() + '</p>' +
      '<h1>Hi ' + esc(p.name) + '</h1>' +
      '<section class="status card level-' + level + '" aria-live="polite"><span class="status-dot" aria-hidden="true"></span><div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
        (night ? '<p class="night-line">🌙 Night Out active – home by ' + esc(fmtTime(night.homeBy)) + '</p>' : '') + '</div></section>' +
      (night ? nightCard(p, night) : '<button type="button" class="btn secondary big full night-start" data-act="night-start">🌙 Going out tonight? Make a plan while you’re sober</button>') +
      (p.demo ? '<section class="card demo-card"><h2>🧪 Demo mode</h2><p>This profile has a pre-made baseline so you can explore right away. Try this:</p><ol>' +
        '<li>Open <a href="#/chat">Messages</a> and tap <b>Simulate an impaired message</b> — or type slowly with lots of corrections.</li>' +
        '<li>Ignore the prompt and watch SecondLook check in, then alert the (fictional) safe contact.</li>' +
        '<li>See every step in the <a href="#/log">Transparency log</a>.</li></ol>' +
        '<div class="row-btns"><button class="btn primary" data-act="contact-view">Open contact view (2nd window)</button><button class="btn secondary" data-act="own-baseline">Use my own baseline</button><button class="btn ghost" data-act="exit-demo">Exit demo</button></div>' +
        '<p class="small muted">The contact view shows what Priya sees. Put it side by side with this window: alerts and replies travel end-to-end encrypted through ntfy.sh.</p></section>' : '') +
      '<div class="tiles">' +
        '<a href="#/chat" class="tile"><span class="tile-ico" aria-hidden="true">💬</span><b>Messages</b><small>Texts get a second look if they seem off</small></a>' +
        '<a href="#/check" class="tile"><span class="tile-ico" aria-hidden="true">🩺</span><b>Quick check</b><small>About a minute, compared with your baseline</small></a>' +
        '<button type="button" class="tile" data-act="ride"><span class="tile-ico" aria-hidden="true">🚗</span><b>Get a ride home</b><small>Uber, Ola, Rapido — or ' + esc(p.contact.name) + '</small></button>' +
      '</div>' +
      '<section class="card"><h2>Your safety net</h2><dl class="kv">' +
        '<dt>Safe contact</dt><dd>' + esc(p.contact.name) + ' · ' + esc(p.contact.phone) + '</dd>' +
        '<dt>Second-look prompt waits</dt><dd>' + s.nudgeTimeout + ' s before checking in</dd>' +
        '<dt>Check-in waits</dt><dd>' + s.checkinTimeout + ' s for your answer</dd>' +
        '<dt>If you don’t answer</dt><dd>' + (p.consent.notifyOnTimeout ? 'Alert ' + esc(p.contact.name) + (p.consent.shareLocation ? ' with your location' : '') : 'Nobody is contacted (you chose this)') + '</dd>' +
        '<dt>Encrypted contact link</dt><dd>' + (p.link ? 'On — ' + esc(p.contact.name) + ' gets a real notification' : 'Off (alerts open your SMS app)') + '</dd>' +
        '<dt>You agreed to this</dt><dd>' + esc(fmtDate(p.consent.agreedAt)) + '</dd>' +
      '</dl><a class="linkish" href="#/settings">Change in settings →</a></section>' +
      '<section class="card"><h2>Your sober baseline</h2>' + baselineGrid(b) +
        '<p class="muted small">Created ' + esc(ago(b.createdAt)) + ' · learned from ' + (b.learned || 0) + ' of your sober messages.</p></section>' +
      '<section class="card"><h2>Tonight</h2>' +
        (lc ? '<p>Last quick check: <b>' + lc.score + '/100</b> (' + esc(levelWord(lc.level)) + ') · ' + esc(ago(lc.at)) + '</p>' : '<p class="muted">No quick checks in the last few hours.</p>') +
        (flags.length ? '<ul class="flags">' + flags.slice().reverse().map(function (f) {
          return '<li>' + (f.source === 'message' ? 'A message looked different · ' + f.score + '/100' : f.source === 'night' ? 'A Night Out check-in was missed' : 'A quick check looked different · ' + f.score + '/100') + ' · ' + esc(fmtTime(f.at)) + '</li>';
        }).join('') + '</ul>' : '<p class="muted">Nothing flagged.</p>') +
      '</section>' +
      '</div>';

    root.addEventListener('click', onHomeClick);
    function onHomeClick(e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act');
      if (act === 'ride') openHelp();
      else if (act === 'exit-demo') { if (confirm('Exit the demo? This clears the demo profile, messages and log from this browser.')) resetAll(); }
      else if (act === 'own-baseline') go('calibrate');
      else if (act === 'contact-view') openContactView();
      else if (act === 'night-start') openNightForm();
      else if (act === 'home-safe') homeSafe();
      else if (act === 'night-demo-remind') demoReminderNow();
    }
    return function () { root.removeEventListener('click', onHomeClick); };
  }
  function levelWord(l) { return l === 'high' ? 'very different' : l === 'caution' ? 'a bit different' : l === 'ok' ? 'like you' : 'unknown'; }

  // ======================================================================
  // view: messages
  // ======================================================================
  var REPLIES = ['haha same', 'where r u now?', 'u getting home ok?', 'the after party is at mike’s', 'lmk when ur home 🙏', '😂😂', 'wait who’s driving?', 'ok ok'];
  var IMPAIRED_SAMPLES = [
    'heyy im fnie tbh cna drive hme now lol',
    'dont wory im totaly good to drvie its close',
    'leavin now gona drive bak its fine relax'
  ];
  var chatDraft = '';

  function analyzeMessage(text, events) {
    var b = getBaseline();
    if (!b || !b.chat) return null;
    var ks = M.analyzeKeystrokes(events);
    if (ks.chars < 12) return null; // too short to say anything
    var sample = Object.assign({}, ks, { oddWordRate: M.oddWordRate(text, DICT, null) });
    var cmp = M.compare(sample, b.chat, M.CHAT_KEYS);
    if (cmp.score == null) return null;
    cmp.sample = sample;
    return cmp;
  }

  function learnFromMessage(sample) {
    var b = getBaseline();
    if (!b) return;
    M.CHAT_KEYS.forEach(function (k) {
      if (typeof sample[k] === 'number' && isFinite(sample[k])) b.chat[k] = M.push(b.chat[k], sample[k]);
    });
    b.learned = (b.learned || 0) + 1;
    saveBaseline(b);
  }

  function synthImpairedEvents(text) {
    var ev = [], t = 0, i = 0;
    Array.from(text).forEach(function () {
      t += 260 + Math.random() * 420;
      if (i > 0 && i % 11 === 0) t += 1800 + Math.random() * 1800;
      if (Math.random() < 0.2) {
        ev.push({ t: t, kind: 'insert', n: 1 });
        t += 300 + Math.random() * 300;
        ev.push({ t: t, kind: 'delete', n: 1 });
        t += 250 + Math.random() * 300;
      }
      ev.push({ t: t, kind: 'insert', n: 1 });
      i++;
    });
    return ev;
  }

  function renderChat(root) {
    var p = getProfile();
    if (!getChat().length) {
      var now = Date.now();
      saveChat([
        { from: 'them', text: 'yo where did everyone go 😂', at: now - 6 * 60e3 },
        { from: 'them', text: 'are u still at the party?', at: now - 5 * 60e3 }
      ]);
    }
    root.innerHTML = '<div class="container chat-wrap">' +
      '<h1 class="sr-only">Messages</h1>' +
      '<div class="chat-head"><span class="avatar" aria-hidden="true">J</span><div><b>Jordan</b><small>SecondLook is on · analysis stays on this device</small></div></div>' +
      '<div class="chat-log" role="log" aria-live="polite" aria-label="Conversation with Jordan"></div>' +
      (p.demo ? '<button type="button" class="linkish sim" id="simulate">🧪 Simulate an impaired message</button>' : '') +
      '<form class="composer" autocomplete="off">' +
        '<label class="sr-only" for="composer">Message</label>' +
        '<textarea id="composer" rows="1" maxlength="600" placeholder="Message Jordan…"></textarea>' +
        '<button class="btn primary send" type="submit" aria-label="Send">Send</button>' +
      '</form>' +
      '<p class="muted tiny center">This is a practice chat. In the full version SecondLook runs as a keyboard, so it works in any messaging app.</p>' +
      '</div>';

    var logEl = $('.chat-log', root), input = $('#composer', root), form = $('.composer', root);
    input.value = chatDraft;
    var rec = new T.KeystrokeRecorder(input);
    var timers = [], draftNudged = false, busy = false;

    function paint() {
      logEl.innerHTML = getChat().map(function (m) {
        return '<div class="msg ' + (m.from === 'me' ? 'me' : 'them') + '"><p>' + esc(m.text) + '</p><span class="meta">' + esc(fmtTime(m.at)) +
          (m.flagged ? ' · sent after a second look' : '') + '</span></div>';
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }
    function commit(text, analysis, flagged) {
      var c = getChat();
      c.push({ from: 'me', text: text, at: Date.now(), flagged: flagged, score: analysis ? analysis.score : null });
      saveChat(c);
      input.value = ''; chatDraft = '';
      rec.reset(); autosize(); paint();
      var wasNudged = draftNudged;
      draftNudged = false;
      if (!flagged && !wasNudged && analysis && analysis.score < 40 && !recentFlags(LOCK_WINDOW).length) learnFromMessage(analysis.sample);
      if (Math.random() < 0.6) {
        timers.push(setTimeout(function () {
          var c2 = getChat();
          c2.push({ from: 'them', text: pick(REPLIES), at: Date.now() });
          saveChat(c2);
          paint();
        }, 1200 + Math.random() * 1500));
      }
    }
    function submitText(text, events) {
      text = text.trim();
      if (!text) return;
      var analysis = analyzeMessage(text, events);
      var threshold = SENSITIVITY[sensitivityNow(getProfile())] || 55;
      if (analysis && analysis.score >= threshold && !draftNudged) {
        draftNudged = true;
        openNudge(text, analysis, {
          onEdit: function () { input.focus(); },
          onSend: function () { commit(text, analysis, true); }
        });
      } else {
        commit(text, analysis, false);
      }
    }
    function onSubmit(e) { e.preventDefault(); if (!busy) submitText(input.value, rec.events); }
    function onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) submitText(input.value, rec.events); }
    }
    function onInput() { chatDraft = input.value; autosize(); }
    form.addEventListener('submit', onSubmit);
    input.addEventListener('keydown', onKey);
    input.addEventListener('input', onInput);

    var sim = $('#simulate', root);
    if (sim) sim.addEventListener('click', function () {
      if (busy) return;
      busy = true; sim.disabled = true;
      var text = pick(IMPAIRED_SAMPLES);
      input.value = '';
      (async function () {
        for (var i = 0; i < text.length; i++) {
          if (!document.contains(input)) return;
          input.value += text[i];
          autosize();
          await sleep(28);
        }
        busy = false; sim.disabled = false;
        rec.reset();
        draftNudged = false;
        submitText(text, synthImpairedEvents(text));
      })();
    });

    paint(); autosize();
    return function () {
      timers.forEach(clearTimeout);
      rec.destroy();
      chatDraft = input.value;
      form.removeEventListener('submit', onSubmit);
    };
  }

  // ======================================================================
  // the "second look" prompt
  // ======================================================================
  function openNudge(text, analysis, hooks) {
    var p = getProfile();
    var secs = p.settings.nudgeTimeout;
    addFlag('message', analysis.score);
    log('nudge', 'Paused a message before it was sent — it looked different from how you usually text (' + analysis.score + '/100).');
    var reasons = M.explain(analysis.rows);
    var timer = null, t0 = Date.now(), resolved = false;
    var modal = openModal(
      '<div class="nudge">' +
        '<div class="nudge-icon" aria-hidden="true">👀</div>' +
        '<h2>Want a second look?</h2>' +
        '<p>This looks a little different from how you usually text.</p>' +
        planHtml(p, getNight(), 'the second-look prompt') +
        '<blockquote class="nudge-msg">' + esc(text) + '</blockquote>' +
        (reasons.length ? '<details><summary>What’s different?</summary><ul>' + reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<div class="stack">' +
          '<button type="button" class="btn primary" data-n="edit" autofocus>Edit message</button>' +
          '<button type="button" class="btn secondary" data-n="send">Send anyway</button>' +
          '<button type="button" class="btn ghost" data-n="check">Check how I’m doing (1 min)</button>' +
        '</div>' +
        '<div class="timeout"><div class="timeout-bar"><span></span></div>' +
        '<p class="tiny">If there’s no answer in <b data-secs>' + secs + '</b>s, SecondLook will check in with you.</p></div>' +
        '<div class="sr-only" aria-live="polite" data-live></div>' +
      '</div>',
      {
        label: 'Want a second look?',
        onClose: function (reason) {
          clearInterval(timer);
          if (!resolved && (reason === 'escape' || reason === 'backdrop')) {
            resolved = true;
            log('nudge', 'You closed the prompt to edit the message.');
            hooks.onEdit();
          }
        }
      });
    var bar = $('.timeout-bar span', modal.el), secsEl = $('[data-secs]', modal.el), live = $('[data-live]', modal.el), spoken = null;
    timer = setInterval(function () {
      var left = secs * 1000 - (Date.now() - t0);
      var sLeft = Math.max(0, Math.ceil(left / 1000));
      bar.style.width = Math.max(0, left / (secs * 10)) + '%';
      secsEl.textContent = sLeft;
      if ((sLeft === 30 || sLeft === 10 || sLeft === 5) && spoken !== sLeft) { spoken = sLeft; live.textContent = sLeft + ' seconds left to answer.'; }
      if (left <= 0 && !resolved) {
        resolved = true;
        clearInterval(timer);
        log('nudge', 'No response to the second-look prompt. The message was not sent.');
        modal.close('timeout');
        startCheckin('You didn’t respond to a second-look prompt.');
      }
    }, 200);
    modal.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]');
      if (!b || resolved) return;
      resolved = true;
      var act = b.getAttribute('data-n');
      modal.close(act);
      if (act === 'edit') {
        log('nudge', 'You chose to take a second look and edit the message.');
        hooks.onEdit();
      } else if (act === 'send') {
        log('nudge', 'You chose to send the message anyway. Your call — SecondLook only asked.');
        hooks.onSend();
        var n = recentFlags(HOUR).length;
        if (n >= 3) startCheckin(n + ' messages in the last hour looked different from your usual.');
        else if (analysis.score >= 85) startCheckin('That message looked very different from how you usually text.');
      } else if (act === 'check') {
        log('nudge', 'You chose to do a quick check.');
        hooks.onEdit();
        go('check');
      }
    });
  }

  // ======================================================================
  // view: quick check
  // ======================================================================
  function renderCheck(root) {
    var p = getProfile(), b = getBaseline();
    var cleanup = null;
    var steps = [
      { key: 'reaction', title: 'Reaction time', desc: 'Tap the moment it turns green. 5 rounds.', trials: 5 },
      { key: 'tracking', title: 'Steady hand', desc: 'Press on the glowing dot and follow it for 10 seconds.', duration: 10000 },
      { key: 'typing', title: 'Typing rhythm', desc: 'Type this the way you normally would.', sentences: T.pickSentences(1) }
    ];
    root.innerHTML = '<div class="container narrow">' +
      '<p class="eyebrow">Quick check · about a minute</p>' +
      '<h1>How am I doing?</h1>' +
      '<p class="lead">Three short tasks, compared with your own sober baseline. Be honest with yourself — only you see the result.</p>' +
      '<button class="btn primary big full" id="check-start">Start the check</button>' +
      (p.demo ? '<button class="btn ghost full" id="check-sim">🧪 Simulate an impaired result</button>' : '') +
      '<p class="muted small">SecondLook can’t measure blood alcohol. A “like you” result doesn’t mean it’s safe to drive.</p>' +
      '</div>';
    $('#check-start', root).addEventListener('click', function () {
      cleanup = runTasks(root, steps, function (res) {
        showResult(M.compare(M.sampleFromTasks(res), b.test, M.TEST_KEYS), false);
      });
    });
    var sim = $('#check-sim', root);
    if (sim) sim.addEventListener('click', function () {
      var t = b.test;
      var sample = {
        reactionMs: t.reactionMs.mean * 1.45, trackingErr: (t.trackingErr.n ? t.trackingErr.mean : 6) * 1.9,
        ikiMs: (t.ikiMs.n ? t.ikiMs.mean : 200) * 1.6, ikiCv: (t.ikiCv.n ? t.ikiCv.mean : 0.6) * 1.4,
        backspaceRate: (t.backspaceRate.n ? t.backspaceRate.mean : 0.08) + 0.2, pauseRate: 1.5, typoRate: 0.12
      };
      showResult(M.compare(sample, t, M.TEST_KEYS), true);
    });

    function showResult(cmp, simulated) {
      var st = getState();
      st.lastCheck = { at: Date.now(), score: cmp.score, level: cmp.level, simulated: simulated };
      saveState(st);
      log('check', (simulated ? '[Demo] ' : '') + 'Quick check: ' + cmp.score + '/100 — ' + levelWord(cmp.level) + ' compared with your sober baseline.');
      if (cmp.level === 'caution' || cmp.level === 'high') addFlag('check', cmp.score);
      var head = {
        ok: ['Looks like your usual self', 'Your reactions, steadiness and typing are close to your sober baseline. If you’ve been drinking, the safest ride is still one you’re not driving.'],
        caution: ['A bit different from your usual', 'Some signs drifted from your baseline. Now’s a good time to pick a ride home or loop in ' + p.contact.name + '.'],
        high: ['Quite different from your usual', 'Several signs are well outside your sober baseline. Please don’t drive tonight.'],
        unknown: ['Not enough data', 'We couldn’t compare this check. Try again, or recalibrate your baseline.']
      }[cmp.level];
      var rows = cmp.rows.slice().sort(function (a, c) { return M.TEST_KEYS.indexOf(a.key) - M.TEST_KEYS.indexOf(c.key); });
      root.innerHTML = '<div class="container narrow">' +
        '<p class="eyebrow">Quick check result' + (simulated ? ' · simulated' : '') + '</p>' +
        '<div class="result level-' + cmp.level + '">' +
          '<div class="gauge" style="--val:' + (cmp.score || 0) + '" role="img" aria-label="Difference from baseline: ' + (cmp.score || 0) + ' out of 100"><span>' + (cmp.score == null ? '—' : cmp.score) + '</span><small>/100</small></div>' +
          '<div><h1>' + esc(head[0]) + '</h1><p>' + esc(head[1]) + '</p></div>' +
        '</div>' +
        '<section class="card"><h2>Compared with your sober self</h2><ul class="bars">' + rows.map(function (r) {
          var def = M.FEATURES[r.key];
          var w = M.clamp(Math.max(0, r.z) / 4 * 100, 3, 100);
          var cls = r.z < 1 ? 'ok' : r.z < 2 ? 'caution' : 'high';
          return '<li><div class="bar-top"><span>' + esc(def.label) + '</span><span class="muted">usual ' + esc(def.fmt(r.baseline)) + ' → now <b>' + esc(def.fmt(r.value)) + '</b></span></div>' +
            '<div class="bar"><span class="' + cls + '" style="width:' + w.toFixed(0) + '%"></span></div></li>';
        }).join('') + '</ul><p class="muted small">Longer bars mean a bigger drift from your baseline. Only drifts in the “impaired” direction count, so being faster than usual never counts against you.</p></section>' +
        (cmp.level !== 'ok' ? '<section class="card">' + helpHtml(p) + '</section>' : '') +
        '<div class="row-btns"><a class="btn secondary" href="#/home">Back home</a><button class="btn ghost" id="again">Check again</button></div>' +
        '<p class="muted small">SecondLook can’t measure blood alcohol. A “like you” result doesn’t mean it’s safe to drive.</p>' +
        '</div>';
      $('#again', root).addEventListener('click', function () { renderView(true); });
      var h = $('h1', root); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
      // Escalate even if the user navigates away from the result.
      if (cmp.level === 'high') {
        setTimeout(function () { startCheckin('Your quick check was well outside your sober baseline.'); }, 2500);
      }
    }
    return function () { if (cleanup) cleanup(); };
  }

  // ======================================================================
  // check-in overlay + alerting your safe contact
  // ======================================================================
  var checkinTimer = null, checkinWidget = null, alertInFlight = false;

  function startCheckin(reason) {
    var p = getProfile();
    if (!p) return;
    var st = getState();
    if (st.checkin && (st.checkin.stage === 'asking' || st.checkin.stage === 'proving')) { showCheckin(); return; }
    st.checkin = { startedAt: Date.now(), deadline: Date.now() + p.settings.checkinTimeout * 1000, reason: reason, stage: 'asking' };
    saveState(st);
    log('checkin', 'SecondLook checked in with you. Reason: ' + reason);
    closeModal('checkin');
    showCheckin();
  }

  function updateCheckin(fn) {
    var st = getState();
    if (!st.checkin) return null;
    fn(st.checkin, st);
    saveState(st);
    return st.checkin;
  }

  function respondCheckin(note) {
    var c = updateCheckin(function (c) { c.stage = 'responded'; c.deadline = null; c.note = note; });
    if (!c) return;
    log('checkin', 'You responded to the check-in: ' + note);
    showCheckin();
  }

  function closeCheckin() {
    var st = getState();
    if (!st.checkin) return;
    var p0 = getProfile();
    if (st.checkin.pushed && p0 && p0.link) {
      publishStatus(p0, p0.name + ' closed the check-in on their phone.');
    }
    st.checkin = null;
    saveState(st);
    log('checkin', 'Check-in closed.');
    showCheckin();
    if (currentView === 'home' || currentView === 'settings') renderView(false);
  }

  function emergencyBtn() {
    return '<button type="button" class="btn danger" data-ci="112">🆘 Call ' + R.EMERGENCY_NUMBER + ' (emergency)</button>';
  }

  /** Confirm step so 112 can't be dialled by accident. */
  function confirmEmergency() {
    var num = R.EMERGENCY_NUMBER;
    var m = openModal('<h2>Call ' + num + '?</h2>' +
      '<p class="muted">This calls India’s emergency number. Use it if you or someone with you is hurt or in danger.</p>' +
      '<div class="stack"><a class="btn danger big" href="' + R.emergencyUrl() + '" id="e-yes">Yes, call ' + num + '</a>' +
      '<button type="button" class="btn ghost" data-close autofocus>Cancel</button></div>', { label: 'Call ' + num + '?' });
    $('#e-yes', m.el).addEventListener('click', function () {
      log('contact', 'You called ' + num + ' (emergency).');
      var c = getState().checkin;
      setTimeout(function () {
        m.close('called');
        if (c && (c.stage === 'asking' || c.stage === 'expired')) respondCheckin('You called ' + num + '.');
      }, 0);
    });
    $('[data-close]', m.el).addEventListener('click', function () {
      log('contact', 'You opened the ' + num + ' button and cancelled.');
      m.close('cancel');
    });
    return m; // Cancel has autofocus: the safe choice is the default
  }

  function consentLine(p) {
    return p.consent.notifyOnTimeout
      ? 'If there’s no response, <b>' + esc(p.contact.name) + '</b> will be alerted — you agreed to this while sober on ' + esc(fmtDate(p.consent.agreedAt)) + '.'
      : 'You chose not to auto-alert anyone, so nobody will be contacted. These options stay here for you.';
  }

  function checkinBody(c, p) {
    var name = esc(p.name), cname = esc(p.contact.name);
    var contactBtns =
      '<a class="btn secondary big" data-ci="text" href="' + esc(smsLink(p.contact.phone, askForRideText(p))) + '">💬 Text ' + cname + '</a>' +
      '<a class="btn secondary big" data-ci="call" href="' + esc(telLink(p.contact.phone)) + '">📞 Call ' + cname + '</a>';
    if (c.stage === 'asking') {
      var left = Math.max(0, Math.ceil((c.deadline - Date.now()) / 1000));
      var total = p.settings.checkinTimeout;
      return '<div class="ci-ring" style="--val:' + Math.round(left / total * 100) + '" role="timer" aria-label="Seconds left to answer"><span id="ci-secs">' + left + '</span><small>sec</small></div>' +
        '<h2 id="ci-title">Hey ' + name + ', just checking in 💙</h2>' +
        '<div class="sr-only" aria-live="assertive" id="ci-live"></div>' +
        '<p class="muted">' + esc(c.reason) + '</p>' +
        planHtml(p, getNight(), 'the check-in') +
        (c.note ? '<p class="ci-note">' + esc(c.note) + '</p>' : '') +
        '<p class="ci-consent">' + consentLine(p) + '</p>' +
        '<div class="ci-actions">' +
          '<button type="button" class="btn primary big" data-ci="ride">🚗 Get a ride home</button>' + contactBtns +
          '<button type="button" class="btn ghost big" data-ci="prove">✅ I’m okay — 15-second check</button>' +
          emergencyBtn() +
        '</div>';
    }
    if (c.stage === 'proving') {
      return '<h2 id="ci-title">Quick reaction check</h2>' +
        '<p class="muted">Tap the moment it turns green — 5 rounds. The countdown is paused.</p>' +
        '<div class="ci-test"></div>' +
        '<button type="button" class="btn ghost" data-ci="back">Back</button>';
    }
    if (c.stage === 'alerted') {
      var pushed = !!c.pushed;
      return '<div class="ci-icon" aria-hidden="true">📣</div>' +
        '<h2 id="ci-title">' + (pushed ? 'We let ' + cname + ' know' : 'Time to let ' + cname + ' know') + '</h2>' +
        '<p>You didn’t respond, so — as you agreed while sober — SecondLook ' + (pushed ? 'sent this alert:' : 'prepared this alert:') + '</p>' +
        (c.alertText ? '<blockquote class="alert-text">' + esc(c.alertText) + '</blockquote>' : '<p class="muted">Preparing the alert…</p>') +
        '<div class="ci-actions">' +
          (c.alertText ? '<a class="btn primary big" data-ci="send-sms" href="' + esc(smsLink(p.contact.phone, c.alertText)) + '">' + (pushed ? 'Also send as SMS' : 'Send alert by SMS') + '</a>' +
            '<a class="btn secondary big" data-ci="send-wa" target="_blank" rel="noopener" href="' + esc(waLink(p.contact.phone, c.alertText)) + '">Send on WhatsApp</a>' : '') +
          '<a class="btn secondary big" data-ci="call" href="' + esc(telLink(p.contact.phone)) + '">📞 Call ' + cname + '</a>' +
          '<button type="button" class="btn secondary big" data-ci="ride">🚗 Get a ride home</button>' +
          '<button type="button" class="btn ghost" data-ci="close">I’m safe — close</button>' +
          emergencyBtn() +
        '</div>' +
        (!pushed && c.pushTried ? '<p class="tiny muted">The encrypted alert couldn’t be delivered (no connection?). Use the SMS or WhatsApp button above.</p>' : '') +
        (pushed ? '<p class="tiny muted">' + cname + ' got a notification saying you may need help. The details above were end-to-end encrypted.</p>' : '') +
        (!pushed && !c.pushTried && c.alertText ? '<p class="tiny muted">Browsers can’t send texts on their own, so this opens your SMS app with the alert pre-written. Set up the <b>encrypted contact link</b> in Settings so ' + cname + ' gets a real notification automatically.</p>' : '');
    }
    if (c.stage === 'expired') {
      return '<div class="ci-icon" aria-hidden="true">🤍</div>' +
        '<h2 id="ci-title">No problem — nobody was contacted</h2>' +
        '<p class="muted">You chose not to auto-alert anyone. If you need a hand getting home, it’s all right here.</p>' +
        planHtml(p, getNight(), 'the check-in') +
        '<div class="ci-actions"><button type="button" class="btn primary big" data-ci="ride">🚗 Get a ride home</button>' + contactBtns +
        '<button type="button" class="btn ghost" data-ci="close">Close</button>' + emergencyBtn() + '</div>';
    }
    // responded
    return '<div class="ci-icon" aria-hidden="true">💙</div>' +
      '<h2 id="ci-title">Good call, ' + name + '</h2>' +
      '<p class="muted">' + esc(c.note || 'Thanks for answering.') + '</p>' +
      planHtml(p, getNight(), 'the check-in') +
      '<div class="help-inline">' + helpHtml(p) + '</div>' +
      '<button type="button" class="btn ghost full" data-ci="close">Close</button>';
  }

  function showCheckin() {
    var root = $('#checkin-root');
    var st = getState(), c = st.checkin, p = getProfile();
    if (checkinWidget) { checkinWidget.destroy(); checkinWidget = null; }
    if (!c || !p) {
      stopCheckinTimer();
      syncReplySub();
      root.hidden = true;
      root.innerHTML = '';
      document.body.classList.remove('no-scroll');
      return;
    }
    root.hidden = false;
    document.body.classList.add('no-scroll');
    root.innerHTML = '<div class="checkin level-' + (c.stage === 'alerted' ? 'high' : 'caution') + '" role="alertdialog" aria-modal="true" aria-labelledby="ci-title"><div class="checkin-inner"><div class="ci-replies" aria-live="assertive"></div>' + checkinBody(c, p) + '</div></div>';

    if (c.stage === 'proving') {
      checkinWidget = T.reactionTest($('.ci-test', root), { trials: 5, onDone: function (r) { finishProve(r); } });
    }
    if (c.stage === 'asking') startCheckinTimer(); else stopCheckinTimer();
    if (c.stage === 'alerted' && !c.alertText && !alertInFlight) sendAlert();
    renderReplies();
    syncReplySub();
    var title = $('#ci-title', root);
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }

  function onCheckinClick(e) {
    var el = e.target.closest('[data-ci]');
    if (!el) return;
    var act = el.getAttribute('data-ci');
    var p = getProfile();
    var c = getState().checkin;
    if (!c || !p) return;
    if (act === 'prove') {
      updateCheckin(function (c) { c.pausedRemaining = Math.max(0, c.deadline - Date.now()); c.deadline = null; c.stage = 'proving'; });
      showCheckin();
    } else if (act === 'back') {
      updateCheckin(function (c) { c.stage = 'asking'; c.deadline = Date.now() + Math.max(c.pausedRemaining || 0, 15000); });
      showCheckin();
    } else if (act === 'ride') {
      if (c.stage === 'asking' || c.stage === 'expired') respondCheckin('You chose to get a ride home.');
      else openHelp();
    } else if (act === 'text' || act === 'call') {
      var what = act === 'text' ? 'You texted ' + p.contact.name + '.' : 'You called ' + p.contact.name + '.';
      // let the link open first, then re-render
      setTimeout(function () {
        if (c.stage === 'asking' || c.stage === 'expired') respondCheckin(what);
        else log('contact', what);
      }, 0);
    } else if (act === 'send-sms' || act === 'send-wa') {
      log('alert', 'You sent the alert to ' + p.contact.name + (act === 'send-sms' ? ' by SMS.' : ' on WhatsApp.'));
    } else if (act === 'close') {
      closeCheckin();
    } else if (act === 'thanks') {
      sendThanks();
    } else if (act === '112') {
      confirmEmergency();
    }
  }

  function finishProve(r) {
    var b = getBaseline();
    var cmp = M.compare({ reactionMs: r.reactionMs }, b.test, ['reactionMs']);
    var pass = (cmp.score == null || cmp.score < 40) && r.falseStarts <= 1;
    if (pass) {
      var st = getState(); st.unlockedAt = Date.now(); saveState(st);
      respondCheckin('You passed a reaction check (' + Math.round(r.reactionMs) + ' ms, your usual is ' + Math.round(b.test.reactionMs.mean) + ' ms). Still — if you’ve been drinking, let someone else drive.');
    } else {
      var note = 'Your reactions were slower than your usual (' + Math.round(r.reactionMs) + ' ms vs ' + Math.round(b.test.reactionMs.mean) + ' ms' +
        (r.falseStarts > 1 ? ', with ' + r.falseStarts + ' early taps' : '') + '). Maybe let someone else drive tonight.';
      log('checkin', 'Reaction check did not pass. ' + note);
      updateCheckin(function (c) {
        c.stage = 'asking';
        c.note = note;
        c.deadline = Date.now() + Math.max(c.pausedRemaining || 0, 15000);
      });
      showCheckin();
    }
  }

  function startCheckinTimer() {
    stopCheckinTimer();
    checkinTimer = setInterval(tickCheckin, 250);
    tickCheckin();
  }
  function stopCheckinTimer() { clearInterval(checkinTimer); checkinTimer = null; }
  function tickCheckin() {
    var c = getState().checkin, p = getProfile();
    if (!c || c.stage !== 'asking' || !c.deadline || !p) { stopCheckinTimer(); return; }
    var left = c.deadline - Date.now();
    var secsEl = $('#ci-secs'), ring = $('.ci-ring');
    var sLeft = Math.max(0, Math.ceil(left / 1000));
    if (secsEl) secsEl.textContent = sLeft;
    var live = $('#ci-live');
    if (live && (sLeft === 30 || sLeft === 10 || sLeft === 5) && live.getAttribute('data-said') !== String(sLeft)) {
      live.setAttribute('data-said', String(sLeft));
      live.textContent = sLeft + ' seconds left before ' + (p.consent.notifyOnTimeout ? p.contact.name + ' is alerted.' : 'this check-in ends.');
    }
    if (ring) ring.style.setProperty('--val', Math.max(0, Math.round(left / (p.settings.checkinTimeout * 10))));
    if (left <= 0) onCheckinTimeout();
  }

  function onCheckinTimeout() {
    stopCheckinTimer();
    var p = getProfile();
    var c = getState().checkin;
    if (!c || c.stage !== 'asking' || !p) return;
    if (p.consent.notifyOnTimeout) {
      updateCheckin(function (c) { c.stage = 'alerted'; c.alertedAt = Date.now(); c.deadline = null; });
      log('alert', 'No response to the check-in. Alerting ' + p.contact.name + ', as you agreed on ' + fmtDate(p.consent.agreedAt) + '.');
      showCheckin(); // triggers sendAlert()
    } else {
      updateCheckin(function (c) { c.stage = 'expired'; c.deadline = null; });
      log('checkin', 'No response to the check-in. Nobody was contacted — auto-alert is off.');
      showCheckin();
    }
  }

  function alertMessage(p, loc) {
    return 'Hi ' + p.contact.name + ', this is an automatic alert from ' + p.name + '’s SecondLook app. ' +
      p.name + ' set this up while sober and asked for you to be contacted if they seemed impaired and didn’t respond to a check-in. ' +
      'They didn’t respond just now and may need help getting home safely — please reach out to them.' +
      (loc ? ' Their location: ' + loc : '') + ' (' + fmtTime(Date.now()) + ')';
  }

  function getLocationLink() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve(''); return; }
      var settled = false;
      var to = setTimeout(function () { if (!settled) { settled = true; resolve(''); } }, 7000);
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (settled) return; settled = true; clearTimeout(to);
          resolve('https://maps.google.com/?q=' + pos.coords.latitude.toFixed(5) + ',' + pos.coords.longitude.toFixed(5));
        }, function () {
          if (settled) return; settled = true; clearTimeout(to); resolve('');
        }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 });
      } catch (e) { settled = true; clearTimeout(to); resolve(''); }
    });
  }

  // ---------- encrypted contact link (ntfy.sh, opt-in) ----------
  function contactPageUrl(p, withKey) {
    return SEC.contactUrl(new URL('contact.html', location.href.split('#')[0]).href, p.link, withKey);
  }

  /** Encrypt → publish to the data topic, then a generic notification that opens the contact page. */
  function publishToContact(p, payload, notifyText) {
    return SEC.encrypt(p.link.key, payload)
      .then(function (ct) { return RL.publish(SEC.dataTopic(p.link.alertTopic), ct); })
      .then(function (okData) {
        if (!okData || !notifyText) return okData;
        return RL.publish(p.link.alertTopic, notifyText, {
          title: 'SecondLook',
          click: contactPageUrl(p, false),
          priority: payload.status === 'test' ? 'default' : 'urgent',
          tags: payload.status === 'test' ? 'wave' : 'rotating_light'
        });
      })
      .catch(function () { return false; });
  }

  function publishStatus(p, text) {
    if (!p || !p.link) return Promise.resolve(false);
    return publishToContact(p, { t: 'status', text: text, at: Date.now(), name: p.name }, null);
  }

  function alertPayload(p, status, loc) {
    var shareHome = p.consent.shareLocation && (p.homeAddress || (p.home && isFinite(p.home.lat)));
    return {
      t: 'alert', status: status, at: Date.now(),
      name: p.name, contactName: p.contact.name,
      // Contact-facing and deliberately general: the contact learns THAT, not the details of how.
      reason: status === 'test' ? 'This is a test.' : 'Their typing or a quick check looked very different from their sober self, and they didn’t answer a check-in in time.',
      loc: loc || null,
      phone: p.myPhone || null,
      home: shareHome ? { address: p.homeAddress || '', lat: p.home ? p.home.lat : null, lng: p.home ? p.home.lng : null } : null
    };
  }

  function openContactView() {
    var p = getProfile();
    if (!p) return;
    if (!p.link) {
      p.link = SEC.newLink();
      saveProfile(p);
      log('data', (p.demo ? '[Demo] ' : '') + 'Created an encrypted contact link for ' + p.contact.name + '.');
    }
    window.open(contactPageUrl(p, true), '_blank');
    log('data', 'Opened the contact view (what ' + p.contact.name + ' sees).');
  }

  // ---------- replies from the contact while a check-in is open ----------
  var REPLY_TEXT = { calling: 'is calling you now', on_my_way: 'is on the way', booking_cab: 'is booking you a cab' };
  var replySub = null, replySubKey = '';
  function syncReplySub() {
    var p = getProfile(), c = getState().checkin;
    var want = p && p.link && c ? p.link.replyTopic + '|' + c.startedAt : '';
    if (want === replySubKey) return;
    if (replySub) { replySub.close(); replySub = null; }
    replySubKey = want;
    if (!want) return;
    try {
      replySub = RL.subscribe([p.link.replyTopic], Math.floor(c.startedAt / 1000) - 5, onReply, function () {});
    } catch (e) { replySub = null; } // fail open: the check-in works without replies
  }
  function onReply(m) {
    var p = getProfile();
    if (!p || !p.link || !SEC.isCiphertext(m.message)) return;
    SEC.decrypt(p.link.key, m.message).then(function (obj) {
      if (!obj || obj.t !== 'reply' || !REPLY_TEXT[obj.action] || typeof obj.at !== 'number') return;
      var added = false;
      updateCheckin(function (c) {
        c.replies = c.replies || [];
        if (c.replies.some(function (r) { return r.id === m.id; })) return;
        c.replies.push({ id: m.id, action: obj.action, at: obj.at });
        added = true;
      });
      if (!added) return;
      log('contact', p.contact.name + ' replied: ' + p.contact.name + ' ' + REPLY_TEXT[obj.action] + ' (' + fmtTime(obj.at) + ').');
      renderReplies();
    }, function () { /* not from our contact (wrong key) — ignore */ });
  }
  function renderReplies() {
    var box = $('#checkin-root .ci-replies');
    if (!box) return;
    var c = getState().checkin, p = getProfile();
    var reps = (c && c.replies) || [];
    if (!reps.length || !p) { box.innerHTML = ''; return; }
    var last = reps[reps.length - 1];
    box.innerHTML = '<div class="reply-banner"><p><b>💬 ' + esc(p.contact.name) + ' ' + REPLY_TEXT[last.action] + '</b> – ' + esc(fmtTime(last.at)) + '</p>' +
      (c.thanked ? '<p class="small">You replied: “Thanks, I’m staying put” ✓</p>' : '<button type="button" class="btn secondary" data-ci="thanks">Thanks, I’m staying put</button>') + '</div>';
  }
  function sendThanks() {
    var p = getProfile();
    if (!p || !p.link) return;
    updateCheckin(function (c) { c.thanked = true; });
    renderReplies();
    publishStatus(p, 'Thanks, I’m staying put.').then(function (ok) {
      log('contact', ok ? 'You told ' + p.contact.name + ': “Thanks, I’m staying put.”' : 'Couldn’t send your reply to ' + p.contact.name + ' — call or text instead.');
      if (!ok) { updateCheckin(function (c) { c.thanked = false; }); renderReplies(); toast('Couldn’t send — call or text instead'); }
    });
  }

  async function sendAlert() {
    if (alertInFlight) return;
    alertInFlight = true;
    try {
      var p = getProfile();
      var loc = p.consent.shareLocation ? await getLocationLink() : '';
      if (p.consent.shareLocation) log('alert', loc ? 'Added your location to the alert.' : 'Couldn’t get your location, so the alert has none.');
      var text = alertMessage(p, loc);
      if (!updateCheckin(function (c) { c.alertText = text; })) return;
      showCheckin();
      if (p.link) {
        var ok = await publishToContact(p, alertPayload(p, 'alerted', loc), 'SecondLook: ' + p.name + ' may need help – tap to open');
        updateCheckin(function (c) { c.pushed = ok; c.pushTried = true; });
        log('alert', ok ? 'Encrypted alert delivered to ' + p.contact.name + ' — their phone got a notification; the details were end-to-end encrypted.'
                        : 'Couldn’t deliver the encrypted alert (no connection?) — the SMS and WhatsApp buttons are ready instead.');
        showCheckin();
      }
    } finally {
      alertInFlight = false;
    }
  }

  // ======================================================================
  // view: transparency log
  // ======================================================================
  var LOG_ICONS = { night: '🌙', extension: '🧩', setup: '📝', baseline: '📏', nudge: '👀', checkin: '💙', alert: '📣', check: '🩺', settings: '🔒', ride: '🚗', contact: '💬', data: '🗂️', action: '•' };

  function renderLog(root) {
    var entries = S.get('log', []);
    root.innerHTML = '<div class="container">' +
      '<h1>Transparency log</h1>' +
      '<p class="lead">Everything SecondLook does is written here, in plain words. Nothing happens behind your back.</p>' +
      '<div class="row-btns"><button class="btn secondary" id="log-dl">Download my log</button><button class="btn secondary" id="log-import">Import extension log</button><button class="btn ghost" id="log-clear">Clear log</button></div>' +
      (entries.length ? '<ol class="log">' + entries.map(function (e) {
        return '<li><span class="log-ico" aria-hidden="true">' + (LOG_ICONS[e.type] || '•') + '</span><div><p>' + esc(e.text) + '</p><time datetime="' + new Date(e.at).toISOString() + '">' + esc(fmtDate(e.at)) + '</time></div></li>';
      }).join('') + '</ol>' : '<p class="muted">Nothing yet.</p>') +
      '<section class="card"><h2>Your data</h2><ul class="ticks">' +
        '<li>Your baseline, messages and this log are stored <b>only in this browser</b>.</li>' +
        '<li>Typing analysis looks at <b>timing and corrections</b>, runs on your device, and nothing is uploaded.</li>' +
        '<li>The only thing that can ever leave your device is an alert <b>you agreed to</b> in advance.</li>' +
        '<li>Safety settings lock for a few hours after something is flagged, so an impaired you can’t quietly undo a sober decision.</li>' +
      '</ul></section></div>';
    $('#log-dl', root).addEventListener('click', function () { downloadJson(S.get('log', []), 'secondlook-log.json'); });
    $('#log-import', root).addEventListener('click', openLogImport);
    $('#log-clear', root).addEventListener('click', function () {
      if (isLocked()) { openUnlock(function () { renderView(false); }); return; }
      if (!confirm('Clear the whole log?')) return;
      S.set('log', []);
      log('data', 'You cleared the log.');
    });
  }

  function downloadJson(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function openLogImport() {
    var m = openModal('<h2>Import extension log</h2>' +
      '<p class="muted">In the extension popup, tap <b>Copy log for the web app</b> and paste it here — or choose the downloaded file. Entries are added to this log so you have one complete record.</p>' +
      '<label class="sr-only" for="log-code">Extension log code</label><textarea id="log-code" class="code" rows="4" placeholder="SLL1…"></textarea>' +
      '<p class="form-error" role="alert" id="log-import-err"></p>' +
      '<div class="row-btns"><button type="button" class="btn primary" id="log-import-go">Import</button>' +
      '<label class="btn ghost file-btn">Choose file<input type="file" accept=".json,application/json" id="log-file"></label>' +
      '<button type="button" class="btn ghost" data-close>Cancel</button></div>', { label: 'Import extension log' });
    function doImport(raw) {
      try {
        var res = SH.mergeLogs(S.get('log', []), SH.decodeCode(raw, SH.LOG_PREFIX), 600);
        S.set('log', res.log);
        m.close('done');
        log('data', 'You imported ' + res.added + ' entries from the browser extension log.');
        toast(res.added + ' entries imported');
      } catch (e) {
        $('#log-import-err', m.el).textContent = e.message || 'Couldn’t read that log.';
      }
    }
    $('#log-import-go', m.el).addEventListener('click', function () { doImport($('#log-code', m.el).value); });
    $('#log-file', m.el).addEventListener('change', function () { var f = this.files && this.files[0]; if (f) f.text().then(doImport); });
    $('[data-close]', m.el).addEventListener('click', function () { m.close('cancel'); });
  }

  // ======================================================================
  // view: settings (locked after a flag — the "sober you decides" rule)
  // ======================================================================
  /** 15-second reaction check in a dialog. opts: { title, text, onPass(r), onFail(r) } */
  function openProve(opts) {
    var b = getBaseline();
    var w = null;
    var m = openModal('<h2>' + esc(opts.title) + '</h2>' +
      '<p class="muted">' + esc(opts.text) + '</p>' +
      '<div class="unlock-test"></div><p class="form-error" id="unlock-msg" role="alert"></p>' +
      '<button type="button" class="btn ghost full" data-close>Cancel</button>',
      { label: opts.title, onClose: function () { if (w) w.destroy(); } });
    $('[data-close]', m.el).addEventListener('click', function () { m.close('cancel'); });
    w = T.reactionTest($('.unlock-test', m.el), {
      trials: 5,
      onDone: function (r) {
        var cmp = M.compare({ reactionMs: r.reactionMs }, b.test, ['reactionMs']);
        var pass = (cmp.score == null || cmp.score < 40) && r.falseStarts <= 1;
        if (pass) { m.close('done'); opts.onPass(r); }
        else {
          if (opts.onFail) opts.onFail(r);
          $('#unlock-msg', m.el).textContent = 'Your reaction time was ' + Math.round(r.reactionMs) + ' ms (usual ' + Math.round(b.test.reactionMs.mean) + ' ms). Not this time — maybe let someone else drive.';
        }
      }
    });
  }

  function openUnlock(after) {
    var b = getBaseline();
    var w = null;
    var m = openModal('<h2>Quick check to unlock</h2>' +
      '<p class="muted">Something was flagged in the last few hours, so safety settings are locked. A 15-second reaction check unlocks them — the plan you made sober stays protected.</p>' +
      '<div class="unlock-test"></div><p class="form-error" id="unlock-msg" role="alert"></p>' +
      '<button type="button" class="btn ghost full" data-close>Cancel</button>',
      { label: 'Unlock settings', onClose: function () { if (w) w.destroy(); } });
    $('[data-close]', m.el).addEventListener('click', function () { m.close('cancel'); });
    w = T.reactionTest($('.unlock-test', m.el), {
      trials: 5,
      onDone: function (r) {
        var cmp = M.compare({ reactionMs: r.reactionMs }, b.test, ['reactionMs']);
        var pass = (cmp.score == null || cmp.score < 40) && r.falseStarts <= 1;
        if (pass) {
          var st = getState(); st.unlockedAt = Date.now(); saveState(st);
          log('settings', 'You unlocked safety settings by passing a reaction check (' + Math.round(r.reactionMs) + ' ms).');
          m.close('done');
          toast('Unlocked for 15 minutes');
          if (after) after();
        } else {
          log('settings', 'A reaction check to unlock settings did not pass — settings stay locked.');
          $('#unlock-msg', m.el).textContent = 'Your reaction time was ' + Math.round(r.reactionMs) + ' ms (usual ' + Math.round(b.test.reactionMs.mean) + ' ms). Settings stay locked for now.';
        }
      }
    });
  }

  function renderSettings(root) {
    var p = getProfile(), b = getBaseline();
    var locked = isLocked() && !!b;
    var s = p.settings;
    function opt(v, cur, label) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    root.innerHTML = '<div class="container narrow">' +
      '<h1>Settings</h1>' +
      (locked ? '<div class="card lock"><h2>🔒 Locked for now</h2><p>Something was flagged in the last few hours. The rules you set while sober can’t be changed right now.</p><button type="button" class="btn secondary" id="unlock">Unlock with a 15-second check</button></div>' : '') +
      '<form id="settings-form" class="card form" novalidate><fieldset class="plain"' + (locked ? ' disabled' : '') + '>' +
        profileFields(p, false) +
        '<fieldset class="group"><legend>How SecondLook responds</legend>' +
          '<label class="field"><span>Sensitivity</span><select name="sensitivity">' +
            opt('gentle', s.sensitivity, 'Gentle — only big changes') + opt('balanced', s.sensitivity, 'Balanced (recommended)') + opt('protective', s.sensitivity, 'Protective — speak up sooner') +
          '</select></label>' +
          '<div class="row2">' +
            '<label class="field"><span>Second-look prompt waits</span><select name="nudgeTimeout">' + [20, 30, 45, 60, 90].map(function (v) { return opt(v, s.nudgeTimeout, v + ' seconds'); }).join('') + '</select></label>' +
            '<label class="field"><span>Check-in waits</span><select name="checkinTimeout">' + [30, 60, 90, 120, 180].map(function (v) { return opt(v, s.checkinTimeout, v + ' seconds'); }).join('') + '</select></label>' +
          '</div>' +
        '</fieldset>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn primary big full" type="submit">Save changes</button>' +
      '</fieldset></form>' +
      homeCard(p, locked) +
      contactLinkCard(p, locked) +
      '<section class="card"><h2>Use it in WhatsApp, Instagram &amp; Gmail</h2>' +
        '<p class="muted">The SecondLook browser extension (Chrome or Edge) gives the same second look on WhatsApp Web, Instagram DMs and Gmail. Paste this code into the extension’s popup. It holds timing numbers and your settings — never messages.</p>' +
        '<button type="button" class="btn secondary" id="ext-export"' + (b ? '' : ' disabled') + '>Show my extension code</button>' +
        '<div id="ext-code-wrap" hidden><label class="sr-only" for="ext-code">Extension code</label><textarea id="ext-code" class="code" rows="4" readonly></textarea>' +
        '<div class="row-btns"><button type="button" class="btn secondary" id="ext-copy">Copy code</button><button type="button" class="btn ghost" id="ext-dl">Download file</button></div>' +
        (location.protocol === 'file:' ? '<p class="small muted">You opened SecondLook as a local file, so the extension can’t open it for check-ins. Use <code>npm start</code> or your GitHub Pages link, then export again.</p>' : '') +
        '</div></section>' +
      '<section class="card"><h2>Baseline</h2><p class="muted">Recalibrate if you changed phones or your baseline feels off. Do it sober.</p>' +
        '<button type="button" class="btn secondary" id="recal"' + (locked ? ' disabled' : '') + '>Recalibrate (2 min)</button></section>' +
      '<section class="card danger"><h2>Delete everything</h2><p class="muted">Removes your profile, baseline, messages and log from this browser.</p>' +
        '<button type="button" class="btn danger" id="reset"' + (locked && !p.demo ? ' disabled' : '') + '>Delete all my data</button></section>' +
      '</div>';

    var form = $('#settings-form', root);
    var unlockBtn = $('#unlock', root);
    if (unlockBtn) unlockBtn.addEventListener('click', function () { openUnlock(function () { renderView(false); }); });

    wireContactLinkCard(root);
    wireHomeCard(root);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isLocked() && b) { toast('Settings are locked right now.'); return; }
      var r = readProfileForm(form, false);
      var err = $('.form-error', form);
      if (r.error) { err.textContent = r.error; return; }
      err.textContent = '';
      var old = getProfile();
      var np = Object.assign({}, old, r.data);
      np.settings = {
        sensitivity: form.elements.sensitivity.value,
        nudgeTimeout: Number(form.elements.nudgeTimeout.value),
        checkinTimeout: Number(form.elements.checkinTimeout.value)
      };
      np.consent = Object.assign({}, r.data.consent, { agreedAt: old.consent.agreedAt });
      var changes = [];
      if (old.contact.name !== np.contact.name || old.contact.phone !== np.contact.phone) changes.push('safe contact is now ' + np.contact.name);
      if (old.consent.notifyOnTimeout !== np.consent.notifyOnTimeout) { changes.push('auto-alert turned ' + (np.consent.notifyOnTimeout ? 'ON' : 'OFF')); np.consent.agreedAt = Date.now(); }
      if (old.consent.shareLocation !== np.consent.shareLocation) { changes.push('location sharing turned ' + (np.consent.shareLocation ? 'ON' : 'OFF')); np.consent.agreedAt = Date.now(); }
      if (old.settings.sensitivity !== np.settings.sensitivity) changes.push('sensitivity set to ' + np.settings.sensitivity);
      if (old.settings.nudgeTimeout !== np.settings.nudgeTimeout || old.settings.checkinTimeout !== np.settings.checkinTimeout) changes.push('wait times ' + np.settings.nudgeTimeout + ' s / ' + np.settings.checkinTimeout + ' s');
      if ((old.myPhone || '') !== (np.myPhone || '')) changes.push('your phone number ' + (np.myPhone ? 'updated' : 'removed'));
      if (old.name !== np.name) changes.push('name updated');
      if (old.homeAddress !== np.homeAddress) changes.push('home address updated');
      saveProfile(np);
      if (changes.length) log('settings', 'You changed settings: ' + changes.join('; ') + '.');
      toast(changes.length ? 'Saved ✓' : 'No changes');
      renderView(false);
    });

    function extData() {
      var n = getNight(), pp = getProfile();
      return SH.buildBaselineExport({ baseline: getBaseline(), profile: pp, flags: getState().flags, appUrl: location.href.split('#')[0],
        nightOut: n ? { startedAt: n.startedAt, homeBy: n.homeBy, planText: NO.planText(n.plan, pp.contact.name), note: n.note } : null });
    }
    $('#ext-export', root).addEventListener('click', function () {
      $('#ext-code', root).value = SH.encodeCode(SH.BASELINE_PREFIX, extData());
      $('#ext-code-wrap', root).hidden = false;
      $('#ext-code', root).select();
      log('data', 'You exported your baseline for the browser extension (timing numbers and settings only).');
    });
    $('#ext-copy', root).addEventListener('click', function () {
      window.SLRides.copyText($('#ext-code', root).value).then(function (ok) { toast(ok ? 'Code copied ✓' : 'Couldn’t copy — select the code and copy it'); });
    });
    $('#ext-dl', root).addEventListener('click', function () { downloadJson(extData(), 'secondlook-baseline.json'); });
    $('#recal', root).addEventListener('click', function () { go('calibrate'); });
    $('#reset', root).addEventListener('click', function () {
      if (confirm('Delete everything SecondLook stored in this browser? This can’t be undone.')) resetAll();
    });
  }

  // ======================================================================
  // Night Out mode
  // ======================================================================
  function nightCard(p, n) {
    var next = NO.nextReminder(n, Date.now());
    return '<section class="card night">' +
      '<h2>🌙 Night Out active – home by ' + esc(fmtTime(n.homeBy)) + '</h2>' +
      planHtml(p, n, 'your Night Out card') +
      '<p class="small muted">' + (next ? 'Next check-in reminder: ' + esc(fmtTime(next)) + '. ' : 'No more check-in reminders. ') +
        'Sensitivity is one level higher tonight (' + esc(sensitivityNow(p)) + ').</p>' +
      '<div class="row-btns"><button type="button" class="btn primary" data-act="home-safe">🏠 Home safe</button>' +
      (p.demo ? '<button type="button" class="btn ghost" data-act="night-demo-remind">🧪 Trigger a check-in reminder now</button>' : '') + '</div>' +
      '</section>';
  }

  function defaultHomeBy() {
    var d = new Date(Date.now() + 3 * HOUR);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function openNightForm() {
    var p = getProfile();
    var cname = esc(p.contact.name);
    var m = openModal('<h2>🌙 Going out tonight?</h2>' +
      '<p class="muted">Decide now, while you’re thinking clearly. Later tonight SecondLook shows you <b>your own plan</b> — not a lecture.</p>' +
      '<form id="night-form" novalidate>' +
        '<fieldset class="group"><legend>How I’m getting home</legend>' +
          '<label class="check"><input type="radio" name="mode" value="cab" checked><span>A cab</span></label>' +
          '<label class="check"><input type="radio" name="mode" value="friend"><span>A friend drives me</span></label>' +
          '<label class="check"><input type="radio" name="mode" value="walk"><span>Walking</span></label>' +
          '<label class="check"><input type="radio" name="mode" value="stay"><span>Staying over</span></label>' +
        '</fieldset>' +
        '<label class="field" data-show="cab"><span>Which app?</span><select name="provider"><option value="uber">Uber</option><option value="ola">Ola</option><option value="rapido">Rapido</option></select></label>' +
        '<label class="field" data-show="friend" hidden><span>Who? <em>(leave empty for ' + cname + ')</em></span><input name="friend" maxlength="40" placeholder="' + cname + '"></label>' +
        '<div class="row2">' +
          '<label class="field"><span>Home by</span><input type="time" name="homeBy" value="' + defaultHomeBy() + '" required></label>' +
          '<label class="field"><span>Check in with me</span><select name="everyMin"><option value="60">Every hour</option><option value="90" selected>Every 90 minutes</option><option value="120">Every 2 hours</option><option value="0">No check-ins</option></select></label>' +
        '</div>' +
        '<label class="field"><span>A note to later-tonight me <em>(optional)</em></span><textarea name="note" rows="2" maxlength="120" placeholder="Don’t drive, ' + esc(p.name) + '. Seriously."></textarea></label>' +
        '<label class="check"><input type="checkbox" name="ntfy"><span>Also send the check-in reminders to <b>my own phone</b> through the free ntfy app. They say only “SecondLook check-in”.</span></label>' +
        '<p class="small muted">Browsers slow down timers in background tabs, so in-app reminders can arrive late. Allow notifications, or tick the ntfy option, to be reminded reliably.</p>' +
        '<p class="form-error" role="alert"></p>' +
        '<div class="row-btns"><button type="submit" class="btn primary">Start Night Out</button><button type="button" class="btn ghost" data-close>Cancel</button></div>' +
      '</form>', { label: 'Going out tonight' });
    var form = $('#night-form', m.el);
    function sync() {
      var mode = form.querySelector('input[name=mode]:checked').value;
      $$('[data-show]', form).forEach(function (el) { el.hidden = el.getAttribute('data-show') !== mode; });
    }
    form.addEventListener('change', sync);
    $('[data-close]', m.el).addEventListener('click', function () { m.close('cancel'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = {
        mode: (form.querySelector('input[name=mode]:checked') || {}).value,
        provider: form.elements.provider.value, friend: form.elements.friend.value,
        homeBy: form.elements.homeBy.value, everyMin: form.elements.everyMin.value, note: form.elements.note.value
      };
      var v = NO.validateForm(f, Date.now(), p.contact.name);
      if (v.error) { $('.form-error', form).textContent = v.error; return; }
      var wantNtfy = form.elements.ntfy.checked;
      var n = NO.create(v, Date.now(), p.settings.sensitivity);
      var st = getState();
      st.nightOut = n;
      saveState(st);
      log('night', 'You started Night Out. ' + NO.planText(n.plan, p.contact.name) + ' Home by ' + fmtTime(n.homeBy) + '. ' +
        (n.reminders.length ? n.reminders.length + ' check-in reminder' + (n.reminders.length === 1 ? '' : 's') + ' (every ' + n.everyMin + ' min). ' : 'No check-in reminders. ') +
        'Sensitivity raised from ' + p.settings.sensitivity + ' to ' + NO.bumpSensitivity(p.settings.sensitivity) + ' for tonight.' + (n.note ? ' You left yourself a note.' : ''));
      m.close('done');
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission().then(function (res) { log('night', 'Browser notifications for reminders: ' + (res === 'granted' ? 'allowed' : 'not allowed') + '.'); });
        } catch (err) { /* ignore */ }
      }
      if (wantNtfy && n.reminders.length) scheduleSelfReminders(p, n);
      renderView(false);
    });
    sync();
  }

  /** Pre-schedule generic reminders on the user's OWN ntfy topic, so they arrive even if this tab is asleep. */
  function scheduleSelfReminders(p, n) {
    if (!p.selfTopic) { p.selfTopic = SEC.newTopic(); saveProfile(p); }
    var click = location.href.split('#')[0] + '#/home';
    Promise.all(n.reminders.map(function (r) {
      return RL.publish(p.selfTopic, 'SecondLook check-in 💙 Open the app and answer — it only takes a tap.', {
        title: 'SecondLook', at: String(Math.floor(r.at / 1000)), click: click, priority: 'high', tags: 'crescent_moon'
      });
    })).then(function (res) {
      var ok = res.filter(Boolean).length;
      updateNight(function (x) { x.selfReminders = ok > 0; });
      log('night', ok ? 'Scheduled ' + ok + ' reminder' + (ok === 1 ? '' : 's') + ' on your own ntfy topic (they say only “SecondLook check-in”).' : 'Couldn’t schedule phone reminders (no connection?) — in-app reminders still work while this tab is open.');
      if (!ok) return;
      var m2 = openModal('<h2>Get the reminders on your phone</h2>' +
        '<p class="muted">Install the free ntfy app and subscribe to your private topic once:</p>' +
        '<p><code class="topic">' + esc(p.selfTopic) + '</code></p>' +
        '<div class="row-btns"><a class="btn primary" href="ntfy://ntfy.sh/' + esc(p.selfTopic) + '">Open in ntfy app</a><a class="btn ghost" target="_blank" rel="noopener" href="https://ntfy.sh/' + esc(p.selfTopic) + '">Use ntfy in the browser</a></div>' +
        '<p class="small muted">Scheduled reminders can’t be cancelled, so if you get home early you may still get one — just ignore it.</p>' +
        '<button type="button" class="btn ghost full" data-close>Done</button>', { label: 'Phone reminders' });
      $('[data-close]', m2.el).addEventListener('click', function () { m2.close('done'); });
    });
  }

  function updateNight(fn) {
    var st = getState();
    if (!st.nightOut) return null;
    fn(st.nightOut, st);
    saveState(st);
    return st.nightOut;
  }

  var reminderModal = null;
  function showReminder(idx, leftMs) {
    var p = getProfile(), n = getNight();
    if (!p || !n) return;
    var t0 = Date.now(), done = false, timer = null, spoken = null;
    reminderModal = openModal('<div class="nudge">' +
      '<div class="nudge-icon" aria-hidden="true">🌙</div>' +
      '<h2>Night Out check-in</h2>' +
      '<p>It’s ' + esc(fmtTime(Date.now())) + ' — how’s it going, ' + esc(p.name) + '?</p>' +
      planHtml(p, n, 'a Night Out reminder') +
      '<div class="stack"><button type="button" class="btn primary" data-r="ok" autofocus>I’m OK</button><button type="button" class="btn secondary" data-r="home">I’m heading home now</button></div>' +
      '<div class="timeout"><div class="timeout-bar"><span></span></div><p class="tiny">If there’s no answer in <b data-secs></b>s, SecondLook will check in with you.</p></div>' +
      '<div class="sr-only" aria-live="polite" data-live></div></div>', {
        label: 'Night Out check-in',
        onClose: function (reason) {
          clearInterval(timer);
          reminderModal = null;
          if (!done && (reason === 'escape' || reason === 'backdrop')) { done = true; answerReminder(idx, 'dismissed the reminder'); }
        }
      });
    var m = reminderModal;
    var bar = $('.timeout-bar span', m.el), secsEl = $('[data-secs]', m.el), live = $('[data-live]', m.el);
    var total = getProfile().settings.nudgeTimeout * 1000;
    function tick() {
      var left = leftMs - (Date.now() - t0);
      var s = Math.max(0, Math.ceil(left / 1000));
      secsEl.textContent = s;
      bar.style.width = Math.max(0, left / total * 100) + '%';
      if ((s === 30 || s === 10 || s === 5) && spoken !== s) { spoken = s; live.textContent = s + ' seconds left to answer.'; }
      if (left <= 0 && !done) { done = true; clearInterval(timer); m.close('timeout'); missReminder(idx); }
    }
    timer = setInterval(tick, 250);
    tick();
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b || done) return;
      done = true;
      m.close('answered');
      answerReminder(idx, b.getAttribute('data-r') === 'home' ? 'I’m heading home now' : 'I’m OK');
    });
  }

  function answerReminder(idx, what) {
    updateNight(function (n) { if (n.reminders[idx]) { n.reminders[idx].status = 'done'; n.reminders[idx].answeredAt = Date.now(); } });
    log('night', 'You answered the Night Out check-in: “' + what + '”.');
    if (/heading home/.test(what)) toast('Safe trip — tap “Home safe” when you’re in 💙');
    if (currentView === 'home') renderView(false);
  }

  function missReminder(idx) {
    updateNight(function (n) { if (n.reminders[idx]) n.reminders[idx].status = 'missed'; });
    addFlag('night', 60); // counts like an ignored prompt (locks settings, shows on the dashboard)
    log('night', 'No answer to the Night Out check-in — that counts like an ignored prompt.');
    startCheckin('You missed a Night Out check-in.');
  }

  function notifyIfHidden() {
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('SecondLook check-in', { body: 'How’s it going? Tap to answer.', tag: 'secondlook-night', icon: 'assets/icon-192.png' });
      }
    } catch (e) { /* notifications are optional */ }
  }

  function nightTick() {
    try {
      var st = getState(), n = st.nightOut, p = getProfile(), now = Date.now();
      if (!n || n.endedAt || !p) return;
      if (!NO.isActive(n, now)) {
        n.endedAt = now; n.autoEnded = true; saveState(st);
        log('night', 'Night Out ended on its own (12 hours after your home-by time).');
        if (currentView === 'home') renderView(false);
        return;
      }
      if (st.checkin) return;                                   // the check-in screen has priority
      if (activeModal && activeModal !== reminderModal) return; // never replace a second-look prompt
      var openIdx = -1;
      (n.reminders || []).forEach(function (r, i) { if (r.status === 'prompted') openIdx = i; });
      if (openIdx >= 0) {
        var left = n.reminders[openIdx].promptedAt + p.settings.nudgeTimeout * 1000 - now;
        if (left <= 0) { if (reminderModal) reminderModal.close('timeout'); missReminder(openIdx); }
        else if (!reminderModal) showReminder(openIdx, left);
        return;
      }
      var d = NO.dueReminder(n, now);
      if (d.due) {
        d.skipped.forEach(function (i) { n.reminders[i].status = 'skipped'; });
        n.reminders[d.due.index].status = 'prompted';
        n.reminders[d.due.index].promptedAt = now;
        saveState(st);
        log('night', 'Night Out check-in reminder (' + fmtTime(d.due.at) + ').' + (d.skipped.length ? ' ' + d.skipped.length + ' earlier reminder(s) were missed while the app was asleep.' : ''));
        notifyIfHidden();
        showReminder(d.due.index, p.settings.nudgeTimeout * 1000);
        return;
      }
      if (NO.isOverdue(n, now)) {
        n.overdueFired = true; saveState(st);
        log('night', 'It’s past your home-by time (' + fmtTime(n.homeBy) + ') plus 30 minutes and “Home safe” wasn’t tapped.');
        startCheckin('You planned to be home by ' + fmtTime(n.homeBy) + ' and haven’t tapped “Home safe” yet.');
      }
    } catch (e) { /* fail open: Night Out must never break the app */ }
  }

  function homeSafe() {
    var st = getState(), n = st.nightOut;
    if (!n || n.endedAt) return;
    if (NO.flaggedSince(st.flags, n.startedAt) && Date.now() < n.homeBy) {
      openProve({
        title: 'Quick check before ending Night Out',
        text: 'Something was flagged tonight, so ending your plan before your home-by time needs a 15-second reaction check.',
        onPass: function (r) { endNight('after passing a reaction check (' + Math.round(r.reactionMs) + ' ms)'); },
        onFail: function () { log('night', 'A reaction check to end Night Out early did not pass — the plan stays on.'); }
      });
      return;
    }
    endNight('');
  }

  function endNight(how) {
    var n = updateNight(function (x) { x.endedAt = Date.now(); });
    if (!n) return;
    var answered = n.reminders.filter(function (r) { return r.status === 'done'; }).length;
    log('night', 'You tapped “Home safe”' + (how ? ' ' + how : '') + '. Night Out ended — ' + answered + ' of ' + n.reminders.length + ' check-ins answered. Sensitivity is back to ' + getProfile().settings.sensitivity + '.' +
      (n.selfReminders ? ' Scheduled phone reminders may still arrive — you can ignore them.' : ''));
    toast('Welcome home 💙');
    renderView(false);
  }

  function demoReminderNow() {
    var n = updateNight(function (x) {
      var r = x.reminders.filter(function (y) { return y.status === 'pending'; })[0];
      if (r) r.at = Date.now() - 1000;
      else x.reminders.push({ at: Date.now() - 1000, status: 'pending' });
    });
    if (n) { log('night', '[Demo] Triggered a Night Out check-in reminder.'); nightTick(); }
  }

  function homeCard(p, locked) {
    var has = p.home && R.hasCoords(p.home);
    return '<section class="card" id="home-card"><h2>One-tap ride home</h2>' +
      '<p class="muted">' + (p.homeAddress ? 'Home address: <b>' + esc(p.homeAddress) + '</b>. ' : 'No home address yet — add it above. ') +
      (has ? 'Home location saved ✓ — Uber opens with home as the destination.' : 'Save your home location once (while you’re at home) so Uber can open with home filled in. For Ola and Rapido we copy your address to paste.') + '</p>' +
      '<p class="small muted">Your location is read by your browser and stored only on this device.</p>' +
      '<div class="row-btns"><button type="button" class="btn secondary" id="home-here"' + (locked ? ' disabled' : '') + '>📍 I’m at home — save this location</button>' +
      (has ? '<button type="button" class="btn ghost" id="home-clear"' + (locked ? ' disabled' : '') + '>Forget home location</button>' : '') + '</div>' +
      '<p class="form-error" id="home-err" role="alert"></p></section>';
  }

  function wireHomeCard(root) {
    var here = $('#home-here', root), clear = $('#home-clear', root);
    if (here) here.addEventListener('click', function () {
      var err = $('#home-err', root);
      if (!navigator.geolocation) { err.textContent = 'This browser can’t share location.'; return; }
      here.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        var p = getProfile();
        p.home = { lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)), at: Date.now() };
        saveProfile(p);
        log('settings', 'You saved your home location for one-tap Uber rides (stored only on this device).');
        toast('Home location saved ✓');
        renderView(false);
      }, function () {
        here.disabled = false;
        err.textContent = location.protocol === 'file:' ? 'Location needs SecondLook to be opened over https (or npm start).' : 'Couldn’t get your location — allow location for this site and try again.';
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
    if (clear) clear.addEventListener('click', function () {
      var p = getProfile();
      delete p.home;
      saveProfile(p);
      log('settings', 'You removed your saved home location.');
      renderView(false);
    });
  }

  function contactLinkCard(p, locked) {
    var cname = esc(p.contact.name);
    if (!p.link) {
      return '<section class="card" id="link-card"><h2>Real notifications for ' + cname + '</h2>' +
        '<p class="muted">Browsers can’t send SMS by themselves. With an <b>encrypted contact link</b>, ' + cname + ' gets a real phone notification when an alert fires — and can tap “I’m on my way” so you see it on your screen.</p>' +
        '<ul class="ticks small"><li>Everything is end-to-end encrypted on your device (AES-GCM). The relay (ntfy.sh) only sees a generic “' + esc(p.name) + ' may need help” notification.</li>' +
        '<li>The key lives only in the link you share with ' + cname + '. Nothing is sent until an alert fires or you send a test.</li></ul>' +
        '<button type="button" class="btn primary" id="link-create"' + (locked ? ' disabled' : '') + '>Set up encrypted alerts</button></section>';
    }
    var url = contactPageUrl(p, true);
    var isFile = location.protocol === 'file:';
    var qr = '';
    try { qr = window.SLQR.toSvg(url, { label: 'QR code of the contact link for ' + p.contact.name }); } catch (e) { qr = ''; }
    return '<section class="card" id="link-card"><h2>Encrypted contact link — on</h2>' +
      '<p class="muted">Send this private link to <b>' + cname + '</b> once. Opening it saves the key on their phone and shows how to turn on notifications.</p>' +
      (isFile ? '<p class="form-error">You opened SecondLook as a local file, so this link won’t open on ' + cname + '’s phone. Host SecondLook (for example on GitHub Pages) and set up the link from there.</p>' : '') +
      '<div class="qr-row">' + (qr ? '<div class="qr">' + qr + '</div>' : '') +
      '<div class="qr-side"><label class="sr-only" for="link-url">Contact link</label><textarea id="link-url" class="code" rows="4" readonly>' + esc(url) + '</textarea>' +
      '<div class="row-btns"><button type="button" class="btn secondary" id="link-copy">Copy link</button>' +
      '<a class="btn secondary" id="link-wa" target="_blank" rel="noopener" href="' + esc(waLink(p.contact.phone, shareText(p, url))) + '">Share on WhatsApp</a>' +
      '<a class="btn ghost" id="link-sms" href="' + esc(smsLink(p.contact.phone, shareText(p, url))) + '">Share by SMS</a></div></div></div>' +
      '<div class="row-btns"><button type="button" class="btn secondary" id="link-test">Send test alert</button>' +
      '<button type="button" class="btn ghost" id="link-preview">Preview what ' + cname + ' sees</button></div>' +
      '<details class="small"><summary>Reset or turn off</summary><p class="muted">Resetting makes new keys — the old link stops working and you’ll need to share the new one.</p>' +
      '<div class="row-btns"><button type="button" class="btn ghost" id="link-reset"' + (locked ? ' disabled' : '') + '>Reset link</button>' +
      '<button type="button" class="btn danger" id="link-off"' + (locked ? ' disabled' : '') + '>Turn off</button></div></details>' +
      '</section>';
  }

  function shareText(p, url) {
    return 'Hi ' + p.contact.name + ', I added you as my safe contact in SecondLook. If I ever don’t answer a check-in on a night out, you’ll get an alert. Please open this link once on your phone — it saves a private key: ' + url;
  }

  function wireContactLinkCard(root) {
    function on(id, fn) { var el = $('#' + id, root); if (el) el.addEventListener('click', fn); }
    on('link-create', function () {
      var p = getProfile();
      try { p.link = SEC.newLink(); } catch (e) { toast(e.message); return; }
      saveProfile(p);
      log('settings', 'You set up an encrypted contact link for ' + p.contact.name + '. Nothing is sent until an alert fires or you send a test.');
      renderView(false);
    });
    on('link-copy', function () {
      window.SLRides.copyText($('#link-url', root).value).then(function (ok) { toast(ok ? 'Link copied ✓' : 'Select the link and copy it'); });
      log('settings', 'You copied the contact link to share with ' + getProfile().contact.name + '.');
    });
    on('link-wa', function () { log('settings', 'You shared the contact link on WhatsApp.'); });
    on('link-sms', function () { log('settings', 'You shared the contact link by SMS.'); });
    on('link-preview', openContactView);
    on('link-test', function () {
      var p = getProfile(), btn = this;
      btn.disabled = true;
      publishToContact(p, alertPayload(p, 'test', null), 'SecondLook test from ' + p.name + ' – tap to open').then(function (ok) {
        btn.disabled = false;
        toast(ok ? 'Test alert sent ✓' : 'Couldn’t reach the alert service — check your connection.');
        log('settings', ok ? 'You sent an encrypted test alert to ' + p.contact.name + '.' : 'A test alert to ' + p.contact.name + ' failed to send.');
      });
    });
    on('link-reset', function () {
      if (isLocked() || !confirm('Make new keys? The old link will stop working.')) return;
      var p = getProfile();
      p.link = SEC.newLink();
      saveProfile(p);
      log('settings', 'You reset the contact link. Share the new link with ' + p.contact.name + '.');
      renderView(false);
    });
    on('link-off', function () {
      if (isLocked() || !confirm('Turn off encrypted alerts? Alerts will fall back to your SMS app.')) return;
      var p = getProfile();
      delete p.link;
      saveProfile(p);
      log('settings', 'You turned off the encrypted contact link.');
      renderView(false);
    });
  }

  function resetAll() {
    closeModal('reset');
    stopCheckinTimer();
    S.clearAll();
    chatDraft = '';
    chatMemory = [];
    showCheckin();
    go('welcome');
    toast('All data deleted');
  }

  // ======================================================================
  // demo profile (for judges / a quick try)
  // ======================================================================
  function loadDemo() {
    var now = Date.now();
    var s = M.seeded;
    saveProfile({
      name: 'Alex', demo: true, createdAt: now - 2 * 86400e3,
      contact: { name: 'Priya', phone: '+1 555 0100' }, homeAddress: '',
      consent: { notifyOnTimeout: true, shareLocation: false, agreedAt: now - 2 * 86400e3 },
      settings: { nudgeTimeout: 20, checkinTimeout: 30, sensitivity: 'balanced' }
    });
    saveBaseline({
      createdAt: now - 2 * 86400e3, learned: 12,
      test: { reactionMs: s(320, 45, 10), trackingErr: s(6, 1.5, 3), ikiMs: s(190, 35, 4), ikiCv: s(0.6, 0.12, 4), backspaceRate: s(0.08, 0.05, 4), pauseRate: s(0.2, 0.3, 4), typoRate: s(0.03, 0.02, 4) },
      chat: { ikiMs: s(210, 45, 12), ikiCv: s(0.65, 0.15, 12), backspaceRate: s(0.09, 0.06, 12), pauseRate: s(0.5, 0.5, 12), oddWordRate: s(0.06, 0.06, 12) }
    });
    var demoNight = NO.create({ plan: { mode: 'cab', provider: 'uber' }, homeBy: now + 2 * HOUR, everyMin: 90, note: 'Don’t drive, Alex. Seriously.' }, now - 20 * 60e3, 'balanced');
    saveState({ flags: [], lastCheck: null, checkin: null, unlockedAt: 0, nightOut: demoNight });
    chatMemory = [];
    S.set('log', [
      { at: now - 2 * 86400e3 + 60e3, type: 'baseline', text: '[Demo] You created your sober baseline. Reaction 320 ms, tracking error 6.0%.' },
      { at: now - 2 * 86400e3, type: 'setup', text: '[Demo] You set up SecondLook. Safe contact: Priya. Auto-alert on no response: ON. Share location: OFF.' }
    ]);
    log('data', 'Demo profile loaded (fictional user “Alex” and safe contact “Priya”), with a Night Out plan: an Uber home by ' + fmtTime(demoNight.homeBy) + '.');
    go('home');
    toast('Demo loaded — open Messages to try it');
  }

  // ======================================================================
  // boot
  // ======================================================================
  var RENDER = { setup: renderSetup, calibrate: renderCalibrate, home: renderHome, chat: renderChat, check: renderCheck, log: renderLog, settings: renderSettings };

  function init() {
    $$('[data-go]').forEach(function (el) { el.addEventListener('click', function () { go(el.getAttribute('data-go')); }); });
    $('#try-demo').addEventListener('click', loadDemo);
    $('#demo-exit').addEventListener('click', function () { if (confirm('Exit the demo and clear its data?')) resetAll(); });
    $('#checkin-root').addEventListener('click', onCheckinClick);
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-log]');
      if (a) log(a.getAttribute('data-log-type') || 'action', a.getAttribute('data-log'));
      var ride = e.target.closest('[data-ride-id]');
      if (ride) onRideClick(ride.getAttribute('data-ride-id'), ride.getAttribute('data-ride-src'));
    });
    window.addEventListener('hashchange', route);

    // Security migration: the old plaintext ntfy topic is replaced by the encrypted contact link.
    var oldP = S.get('profile', null);
    if (oldP && oldP.settings && 'ntfyTopic' in oldP.settings) {
      var had = !!oldP.settings.ntfyTopic;
      delete oldP.settings.ntfyTopic;
      saveProfile(oldP);
      if (had) log('settings', 'Old unencrypted push alerts were turned off. Set up the new encrypted contact link in Settings.');
    }

    // Privacy migration: older versions stored chat text and a word list. Remove both.
    S.remove('chat');
    var oldB = getBaseline();
    if (oldB && oldB.vocab) { delete oldB.vocab; saveBaseline(oldB); }

    // A reload mid-check shouldn't leave the check-in stuck.
    var st = getState();
    if (st.checkin && st.checkin.stage === 'proving') {
      st.checkin.stage = 'asking';
      st.checkin.deadline = Date.now() + Math.max(st.checkin.pausedRemaining || 0, 15000);
      saveState(st);
    }

    route();
    showCheckin();

    // Night Out reminders (the tab may be throttled in the background; we also check on return).
    setInterval(nightTick, 5000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) nightTick(); });
    setTimeout(nightTick, 800);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ }); });
    }
  }

  init();
})();
