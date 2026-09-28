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
  var I = window.SLIcons;
  function ico(n) { return I.icon(n); }
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
  function planHtml(p, n, src, compact) {
    if (!n) return '';
    if (compact) {
      return '<div class="plan-card compact"><p class="plan-title">' + esc(NO.planText(n.plan, p.contact.name)) + '</p>' +
        (n.note ? '<blockquote class="note-to-self">“' + esc(n.note) + '”<span>You wrote this earlier tonight.</span></blockquote>' : '') + '</div>';
    }
    var ride = n.plan.mode === 'cab' ? R.rideById(n.plan.provider, { address: p.homeAddress, home: p.home }) : null;
    var text = NO.planText(n.plan, p.contact.name);
    var friendSms = n.plan.mode === 'friend' && n.plan.friendIsContact
      ? '<a class="btn secondary" href="' + esc(smsLink(p.contact.phone, askForRideText(p))) + '" data-log-type="contact" data-log="Texted ' + esc(p.contact.name) + ' for the ride you planned">' + ico('message') + 'Text ' + esc(p.contact.name) + '</a>' : '';
    return '<div class="plan-card"><p class="plan-title">' + esc(text) + (ride ? ' Here it is →' : '') + '</p>' +
      (ride || friendSms ? '<div class="btn-row">' +
        (ride ? '<a class="btn primary" href="' + esc(ride.url) + '" target="_blank" rel="noopener" data-ride-id="' + ride.id + '" data-ride-src="' + esc(src || 'your Night Out plan') + '">' + ico('car') + 'Open ' + esc(ride.name) + '</a>' : '') +
        friendSms + '</div>' : '') +
      (n.note ? '<blockquote class="note-to-self">“' + esc(n.note) + '”<span>You wrote this earlier tonight.</span></blockquote>' : '') +
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
    var hint = p.home && R.hasCoords(p.home) ? 'Uber opens with your home filled in (✓). For the others we copy your address so you can paste it.'
      : p.homeAddress ? 'We’ll copy your home address when you open a ride app, so you can paste it.'
      : 'Add your home address in Settings for one-tap rides.';
    var ask = askForRideText(p);
    return '<div class="help">' +
      '<h3>Book a ride</h3><div class="rides">' + rides + '</div><p class="small muted ride-hint">' + esc(hint) + '</p>' +
      '<h3>Or ask ' + esc(p.contact.name) + '</h3>' +
      '<div class="contact-actions">' +
        '<a class="btn secondary" href="' + esc(telLink(p.contact.phone)) + '" data-log-type="contact" data-log="Called ' + esc(p.contact.name) + '">' + ico('phone') + 'Call</a>' +
        '<a class="btn secondary" href="' + esc(smsLink(p.contact.phone, ask)) + '" data-log-type="contact" data-log="Texted ' + esc(p.contact.name) + ' for a ride">' + ico('message') + 'Text</a>' +
        '<a class="btn secondary" href="' + esc(waLink(p.contact.phone, ask)) + '" target="_blank" rel="noopener" data-log-type="contact" data-log="Messaged ' + esc(p.contact.name) + ' on WhatsApp">WhatsApp</a>' +
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
    var night = !!(getState().checkin || getNight() || recentFlags(LOCK_WINDOW).length);
    var m = openModal((night ? '<div class="sheet-grip" aria-hidden="true"></div>' : '') +
      '<h2>Get home safe</h2><p class="muted">Leaving the car is always the right call.</p>' + helpHtml(p) +
      '<button type="button" class="btn secondary full" data-close>Close</button>', { label: 'Get home safe', sheet: night, night: night });
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
    wrap.className = 'modal-backdrop' + (opts.sheet ? ' sheet-backdrop' : '');
    if (opts.night) wrap.setAttribute('data-mode', 'night');
    wrap.innerHTML = '<div class="modal' + (opts.sheet ? ' sheet' : '') + (opts.rise ? ' rise' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.label || 'Dialog') + '">' + html + '</div>';
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
    $('#topnav').hidden = !appReady;
    document.body.classList.toggle('has-tabbar', appReady);
    $$('#tabbar a, #topnav a').forEach(function (a) {
      if (a.getAttribute('href') === '#/' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    // Night Mode: the dashboard, messages and check dim themselves on a flagged night or during a Night Out.
    var night = appReady && ['home', 'chat', 'check'].indexOf(v) >= 0 && !!(getNight() || recentFlags(LOCK_WINDOW).length);
    document.body.setAttribute('data-mode', night ? 'night' : 'day');
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', night ? '#111317' : '#F2F4F1');
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
      '<fieldset data-step="1"><legend>About you</legend>' +
        '<label class="field"><span>Your first name</span><input name="name" maxlength="40" autocomplete="given-name" value="' + esc(p.name) + '" required></label>' +
        '<label class="field"><span>Your phone number <em>(optional)</em></span><input name="myPhone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="' + esc(p.myPhone || '') + '"></label>' +
        '<p class="hint">Only used so your contact can call you back from an alert.</p>' +
      '</fieldset>' +
      '<fieldset data-step="2"><legend>Your safe contact</legend>' +
        '<p class="hint">Someone you trust to help you get home. They only hear from SecondLook if you agree to it.</p>' +
        '<div class="row2">' +
          '<label class="field"><span>Their name</span><input name="contactName" maxlength="40" value="' + esc(p.contact.name) + '" required></label>' +
          '<label class="field"><span>Their phone, with country code</span><input name="contactPhone" type="tel" inputmode="tel" maxlength="20" placeholder="+91 98765 43210" value="' + esc(p.contact.phone) + '" required></label>' +
        '</div>' +
      '</fieldset>' +
      '<fieldset data-step="3"><legend>Getting home</legend>' +
        '<label class="field"><span>Home address <em>(optional)</em></span><input name="homeAddress" maxlength="140" autocomplete="street-address" value="' + esc(p.homeAddress) + '"></label>' +
        '<p class="hint">We copy it for Ola and Rapido so you can paste it, and Uber can open with home filled in.</p>' +
      '</fieldset>' +
      '<fieldset data-step="4"><legend>' + (isSetup ? 'Your promises' : 'What you agreed to') + '</legend>' +
        '<label class="choice"><input type="checkbox" name="notifyOnTimeout"' + checked(p.consent.notifyOnTimeout) + '><span><b>Alert my safe contact</b> if SecondLook checks in with me and I don’t answer in time.</span></label>' +
        '<label class="choice"><input type="checkbox" name="shareLocation"' + checked(p.consent.shareLocation) + '><span>Include my location and home address in that alert.</span></label>' +
        (isSetup ?
          '<label class="choice"><input type="checkbox" name="transparency"><span>I understand SecondLook will <b>always tell me</b> what it did and keep a log I can read.</span></label>' +
          '<label class="choice"><input type="checkbox" name="sober"><span>I’m setting this up <b>while sober</b>.</span></label>' : '') +
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
  var SETUP_STEPS = [
    { title: 'What should we call you?', lead: 'You’re making a plan now, while your head is clear. Later tonight, SecondLook keeps that promise for you.' },
    { title: 'Who’s your safe contact?', lead: 'The person you’d want to hear from if you can’t get yourself home.' },
    { title: 'Where’s home?', lead: 'So a ride home is one tap away. You can skip this.' },
    { title: 'Your promises', lead: 'These are the rules SecondLook follows later. You can change them any time you’re sober.' }
  ];
  function stepperHtml(n, total, label) {
    return '<div class="stepper"><p class="stepper-label">Step ' + n + ' of ' + total + ': ' + esc(label) + '</p>' +
      '<div class="stepper-bar" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="' + n + '"><span style="width:' + Math.round(n / total * 100) + '%"></span></div></div>';
  }

  function renderSetup(root) {
    var step = 1, total = SETUP_STEPS.length + 1; // + the baseline
    root.innerHTML = '<div class="page">' +
      '<div data-stepper></div>' +
      '<h1 id="setup-title"></h1><p class="lead" id="setup-lead"></p>' +
      '<form id="setup-form" novalidate>' + profileFields(null, true) +
        '<p class="form-error" role="alert"></p>' +
        '<div class="step-nav"><button type="button" class="btn secondary" data-back>Back</button>' +
        '<button type="submit" class="btn primary big" data-next>Next</button></div>' +
      '</form></div>';
    var form = $('#setup-form', root), err = $('.form-error', form);
    function show() {
      var meta = SETUP_STEPS[step - 1];
      $('[data-stepper]', root).innerHTML = stepperHtml(step, total, ['About you', 'Safe contact', 'Getting home', 'Promises'][step - 1]);
      $('#setup-title', root).textContent = meta.title;
      $('#setup-lead', root).textContent = meta.lead;
      $$('fieldset[data-step]', form).forEach(function (f) { f.hidden = Number(f.getAttribute('data-step')) !== step; });
      $('[data-back]', form).hidden = step === 1;
      $('[data-next]', form).textContent = step === SETUP_STEPS.length ? 'Save my plan' : step === 3 && !form.elements.homeAddress.value.trim() ? 'Skip for now' : 'Next';
      err.textContent = '';
      var first = $('fieldset[data-step="' + step + '"] input', form);
      if (first && step > 1) setTimeout(function () { first.focus(); }, 30);
    }
    function stepError() {
      var fd = new FormData(form);
      function get(k) { return String(fd.get(k) || '').trim(); }
      if (step === 1) {
        if (!get('name')) return 'Please add your first name.';
        if (get('myPhone') && !validPhone(get('myPhone'))) return 'Your phone number looks incomplete (7–15 digits). Fix it or leave it empty.';
      }
      if (step === 2) {
        if (!get('contactName')) return 'Add your safe contact’s name.';
        if (!validPhone(get('contactPhone'))) return 'Add their phone number with the country code, for example +91 98765 43210.';
      }
      return '';
    }
    form.elements.homeAddress.addEventListener('input', function () { if (step === 3) show(); });
    $('[data-back]', form).addEventListener('click', function () { step = Math.max(1, step - 1); show(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (step < SETUP_STEPS.length) {
        var msg = stepError();
        if (msg) { err.textContent = msg; return; }
        step++; show();
        return;
      }
      var r = readProfileForm(form, true);
      if (r.error) { err.textContent = r.error; return; }
      var p = Object.assign(r.data, { createdAt: Date.now(), settings: Object.assign({}, DEFAULT_SETTINGS), demo: false });
      p.consent.agreedAt = Date.now();
      saveProfile(p);
      log('setup', 'You set up SecondLook. Safe contact: ' + p.contact.name + '. Auto-alert on no response: ' + (p.consent.notifyOnTimeout ? 'ON' : 'OFF') + '. Share location: ' + (p.consent.shareLocation ? 'ON' : 'OFF') + '.');
      go('calibrate');
    });
    show();
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

  var TASK_GUIDE = {
    reaction: ['hand', 'Keep a finger ready. Tap only when it turns green, not before.'],
    tracking: ['hand', 'Put your finger (or cursor) on the glowing dot and stay on it as it moves.'],
    typing: ['keyboard', 'Type the way you normally text. Small mistakes are fine.']
  };

  /** Shared 3-task runner used by calibration and quick check. */
  function runTasks(root, steps, onFinish, label) {
    var widget = null, results = {};
    function run(i) {
      if (widget) { widget.destroy(); widget = null; }
      if (i >= steps.length) { onFinish(results); return; }
      var s = steps[i], g = TASK_GUIDE[s.key];
      root.innerHTML = '<div class="page">' +
        '<div class="stepper"><p class="stepper-label">' + esc(label || 'Task') + ' ' + (i + 1) + ' of ' + steps.length + ': ' + esc(s.title) + '</p>' +
        '<div class="stepper-bar" role="progressbar" aria-label="Progress" aria-valuemin="1" aria-valuemax="' + steps.length + '" aria-valuenow="' + (i + 1) + '"><span style="width:' + Math.round((i + 1) / steps.length * 100) + '%"></span></div></div>' +
        '<h1>' + esc(s.title) + '</h1><p class="lead">' + esc(s.desc) + '</p>' +
        '<div class="task-guide">' + ico(g[0]) + '<p>' + esc(g[1]) + '</p></div>' +
        '<div class="task-host"></div></div>';
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
      { key: 'tracking', title: 'Steady hand', desc: 'Follow the glowing dot for 12 seconds.', duration: 12000 },
      { key: 'typing', title: 'Typing rhythm', desc: 'Type two short sentences.', sentences: T.pickSentences(2) }
    ];
    root.innerHTML = '<div class="page">' +
      (old ? '' : stepperHtml(5, 5, 'Your sober baseline')) +
      '<h1>' + (old ? 'Recalibrate your baseline' : 'Now, the sober you') + '</h1>' +
      '<p class="lead">Three short tasks, about two minutes. SecondLook only ever compares you with you, so do this when you’re sober and rested, ' + esc(p.name) + '.</p>' +
      '<ol class="data-notes">' +
        '<li>' + ico('hand') + '<span><b>Reaction time.</b> Alcohol slows how fast you respond.</span></li>' +
        '<li>' + ico('eye') + '<span><b>Steady hand.</b> Fine movements get shakier.</span></li>' +
        '<li>' + ico('keyboard') + '<span><b>Typing rhythm.</b> More pauses, corrections and typos.</span></li>' +
      '</ol>' +
      '<div class="step-nav">' + (old ? '<a class="btn secondary" href="#/home">Cancel</a>' : '') +
      '<button class="btn primary big" id="calib-start">Start the tasks</button></div>' +
      '</div>';
    $('#calib-start', root).addEventListener('click', function () {
      cleanup = runTasks(root, steps, function (res) {
        var b = buildBaseline(res, old);
        saveBaseline(b);
        log('baseline', (old ? 'You recalibrated' : 'You created') + ' your sober baseline. Reaction ' + Math.round(b.test.reactionMs.mean) + ' ms' +
          (b.test.trackingErr.n ? ', tracking error ' + b.test.trackingErr.mean.toFixed(1) + '%' : '') + '.');
        showBaselineSummary(root, b);
      }, 'Task');
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
    root.innerHTML = '<div class="page">' +
      '<div data-level="ok">' + I.eye({ level: 'ok', className: 'done-mark' }) + '</div>' +
      '<h1>Baseline saved</h1>' +
      '<p class="lead">This is you on a normal day. From now on SecondLook compares against it, and keeps learning from the messages you send while sober.</p>' +
      baselineGrid(b) +
      '<div class="step-nav"><a class="btn primary big" href="#/home">Go to my dashboard</a></div>' +
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
    var cname = esc(p.contact.name);
    var level = 'ok', title = 'All quiet tonight', text = 'Your messages are compared with your sober self, only on this device.';
    if (flags.length || (lc && lc.level === 'caution')) {
      level = 'caution';
      title = 'A bit different tonight';
      text = flags.length === 1 ? 'One thing looked unlike you. If you’ve been drinking, a ride home is one tap away.' : flags.length > 1 ? flags.length + ' things looked unlike you. If you’ve been drinking, a ride home is one tap away.' : 'Your last check was a bit off. Take it easy.';
    }
    if ((lc && lc.level === 'high') || flags.length >= 3) {
      level = 'high';
      title = 'Please don’t drive tonight';
      text = 'Several signs are well outside your sober self. A ride home is one tap away.';
    }
    var s = p.settings;
    var modeNote = night ? 'Night Out active – home by ' + fmtTime(night.homeBy) + '. Night Mode stays on until you’re home safe.'
      : flags.length ? 'Night Mode is on because something was flagged tonight.' : '';
    var rideIsPrimary = !night ? false : !planRide(p);
    root.innerHTML = '<div class="page">' +
      (p.demo ? '<div class="demo-bar demo-card">' + ico('flask') + '<p><b>Demo mode.</b> Open the contact view in a second window, then simulate a message in Messages.</p>' +
        '<button type="button" class="btn secondary" data-act="contact-view">Open contact view</button>' +
        '<button type="button" class="btn quiet" data-act="own-baseline">Use my own baseline</button></div>' : '') +
      '<section class="status-hero status" data-level="' + level + '" aria-live="polite">' +
        I.eye({ level: level, label: 'Status: ' + title }) +
        '<div><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p>' +
        (modeNote ? '<p class="mode-note">' + ico('moon') + esc(modeNote) + '</p>' : '') + '</div>' +
      '</section>' +
      (night ? nightCard(p, night) : '') +
      '<div class="actions">' +
        (night ? '' : '<button type="button" class="action primary" data-act="night-start">' + ico('moon') + '<span><b>Going out tonight?</b><small>Make your plan while you’re sober</small></span></button>') +
        '<button type="button" class="action' + (rideIsPrimary ? ' primary' : '') + '" data-act="ride">' + ico('car') + '<span><b>Get a ride home</b><small>Uber, Ola, Rapido or ' + cname + '</small></span></button>' +
        '<a class="action" href="#/check">' + ico('pulse') + '<span><b>Quick check</b><small>One minute, compared with you</small></span></a>' +
      '</div>' +
      '<div class="section">' +
        '<details class="more"' + (flags.length ? ' open' : '') + '><summary>Tonight <small>' + (flags.length ? flags.length + ' flagged' : 'Nothing flagged') + '</small></summary><div class="more-body">' +
          (lc ? '<p>Your last quick check scored <b>' + lc.score + ' out of 100</b>, ' + esc(levelWord(lc.level)) + ', ' + esc(ago(lc.at)) + '.</p>' : '<p class="muted">No quick checks in the last few hours.</p>') +
          (flags.length ? '<ul class="timeline-mini">' + flags.slice().reverse().map(function (f) {
            return '<li><time>' + esc(fmtTime(f.at)) + '</time><span>' + (f.source === 'message' ? 'A message looked different (' + f.score + ' out of 100)' : f.source === 'night' ? 'A Night Out check-in was missed' : 'A quick check looked different (' + f.score + ' out of 100)') + '</span></li>';
          }).join('') + '</ul>' : '') +
        '</div></details>' +
        '<details class="more"><summary>Your safety net <small>' + cname + '</small></summary><div class="more-body"><dl class="kv">' +
          '<dt>Safe contact</dt><dd>' + cname + ', ' + esc(p.contact.phone) + '</dd>' +
          '<dt>If you don’t answer</dt><dd>' + (p.consent.notifyOnTimeout ? cname + ' gets an alert' + (p.consent.shareLocation ? ' with your location' : '') : 'Nobody is contacted (your choice)') + '</dd>' +
          '<dt>Real notifications</dt><dd>' + (p.link ? 'On. ' + cname + '’s phone gets a notification.' : 'Off. Alerts open your SMS app.') + '</dd>' +
          '<dt>Waiting times</dt><dd>' + s.nudgeTimeout + ' seconds on a prompt, ' + s.checkinTimeout + ' seconds on a check-in</dd>' +
          '<dt>You agreed on</dt><dd>' + esc(fmtDate(p.consent.agreedAt)) + '</dd>' +
        '</dl><a class="btn secondary" href="#/settings">Change in Settings</a></div></details>' +
        '<details class="more"><summary>Your sober baseline</summary><div class="more-body">' + baselineGrid(b) +
          '<p class="small muted">Made ' + esc(ago(b.createdAt)) + '. It has learned from ' + (b.learned || 0) + ' of your sober messages since.</p></div></details>' +
      '</div>' +
      (p.demo ? '<p class="small muted section">Finished exploring? <button type="button" class="linkish" data-act="exit-demo">Exit the demo</button></p>' : '') +
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
    root.innerHTML = '<div class="chat">' +
      '<h1 class="sr-only">Messages</h1>' +
      '<div class="chat-head"><span class="avatar" aria-hidden="true">J</span><div><b>Jordan</b><small>' + ico('shield') + 'SecondLook is on. Only your typing rhythm is checked, on this device.</small></div></div>' +
      '<p class="chat-day">Tonight</p>' +
      '<div class="chat-log" role="log" aria-live="polite" aria-label="Conversation with Jordan"></div>' +
      (p.demo ? '<button type="button" class="btn quiet sim" id="simulate">' + ico('flask') + 'Simulate an impaired message</button>' : '') +
      '<form class="composer" autocomplete="off">' +
        '<label class="sr-only" for="composer">Message</label>' +
        '<textarea id="composer" rows="1" maxlength="600" placeholder="Message Jordan"></textarea>' +
        '<button class="btn primary send" type="submit" aria-label="Send message">' + ico('send') + '</button>' +
      '</form>' +
      '<p class="chat-note">This is a practice chat. The full version works as a keyboard in any messaging app.</p>' +
      '</div>';

    var logEl = $('.chat-log', root), input = $('#composer', root), form = $('.composer', root);
    input.value = chatDraft;
    var rec = new T.KeystrokeRecorder(input);
    var timers = [], draftNudged = false, busy = false;

    function paint() {
      logEl.innerHTML = getChat().map(function (m) {
        return '<div class="msg ' + (m.from === 'me' ? 'me' : 'them') + '"><p>' + esc(m.text) + '</p><span class="meta">' + esc(fmtTime(m.at)) +
          (m.flagged ? ', sent after a second look' : '') + '</span></div>';
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
      '<div class="sheet-grip" aria-hidden="true"></div>' +
      '<div class="nudge">' +
        I.eye({ level: 'count' }) +
        '<h2>Want a second look?</h2>' +
        '<p>This doesn’t look like how you usually text' + (reasons.length ? ': <b>' + esc(reasons[0].charAt(0).toLowerCase() + reasons[0].slice(1)) + '</b>.' : '.') + '</p>' +
        planHtml(p, getNight(), 'the second-look prompt', true) +
        '<div class="countdown"><p>Checking in with you in <b data-secs>' + secs + '</b>s</p><div class="timeout-bar"><span></span></div></div>' +
        '<div class="stack">' +
          '<button type="button" class="btn primary big" data-n="edit" autofocus>Edit my message</button>' +
          '<button type="button" class="btn secondary" data-n="send">Send it anyway</button>' +
          '<button type="button" class="btn quiet" data-n="check">Check how I’m doing</button>' +
        '</div>' +
        '<div class="sr-only" aria-live="polite" data-live></div>' +
      '</div>',
      {
        label: 'Want a second look?',
        sheet: true, night: true, rise: true,
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
    root.innerHTML = '<div class="page">' +
      '<h1>How am I doing?</h1>' +
      '<p class="lead">Three short tasks, about a minute, compared with your own sober self. Only you see the result.</p>' +
      '<div class="step-nav"><button class="btn primary big" id="check-start">Start the check</button></div>' +
      (p.demo ? '<p><button class="btn quiet" id="check-sim">' + ico('flask') + 'Simulate an impaired result</button></p>' : '') +
      '<p class="small muted">SecondLook can’t measure blood alcohol. A result that looks like you doesn’t mean it’s safe to drive.</p>' +
      '</div>';
    $('#check-start', root).addEventListener('click', function () {
      cleanup = runTasks(root, steps, function (res) {
        showResult(M.compare(M.sampleFromTasks(res), b.test, M.TEST_KEYS), false);
      }, 'Task');
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
      var lvl = cmp.level === 'unknown' ? 'ok' : cmp.level;
      root.innerHTML = '<div class="page">' +
        '<div class="result" data-level="' + lvl + '">' +
          '<div class="gauge" role="img" aria-label="Difference from your baseline: ' + (cmp.score || 0) + ' out of 100">' +
            I.eye({ level: lvl, progress: (cmp.score || 0) / 100 }) + '<span>' + (cmp.score == null ? '–' : cmp.score) + '</span><small>out of 100</small></div>' +
          '<div><h1>' + esc(head[0]) + (simulated ? ' (simulated)' : '') + '</h1><p>' + esc(head[1]) + '</p></div>' +
        '</div>' +
        '<section class="section"><h2>Compared with your sober self</h2><ul class="bars">' + rows.map(function (r) {
          var def = M.FEATURES[r.key];
          var w = M.clamp(Math.max(0, r.z) / 4 * 100, 3, 100);
          var cls = r.z < 1 ? 'ok' : r.z < 2 ? 'caution' : 'high';
          return '<li><div class="bar-top"><span>' + esc(def.label) + '</span><span class="muted">usually ' + esc(def.fmt(r.baseline)) + ', now <b>' + esc(def.fmt(r.value)) + '</b></span></div>' +
            '<div class="bar"><span class="' + cls + '" style="width:' + w.toFixed(0) + '%"></span></div></li>';
        }).join('') + '</ul><p class="small muted">Longer bars mean a bigger drift from your baseline. Being faster than usual never counts against you.</p></section>' +
        (cmp.level !== 'ok' ? '<section class="section panel">' + helpHtml(p) + '</section>' : '') +
        '<div class="btn-row section"><a class="btn secondary" href="#/home">Back home</a><button class="btn quiet" id="again">Check again</button></div>' +
        '<p class="small muted">SecondLook can’t measure blood alcohol. A result that looks like you doesn’t mean it’s safe to drive.</p>' +
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

  /** The user's own plan as the one primary action: "Open Uber, like you planned". */
  function planRide(p) {
    var n = getNight();
    if (!n || n.plan.mode !== 'cab') return null;
    return R.rideById(n.plan.provider, { address: p.homeAddress, home: p.home });
  }
  function primaryRideBtn(p, src) {
    var ride = planRide(p);
    if (ride) return '<a class="btn primary big" data-ci="ride-plan" data-ride-id="' + ride.id + '" data-ride-src="' + esc(src) + '" href="' + esc(ride.url) + '" target="_blank" rel="noopener">' + ico('car') + 'Open ' + esc(ride.name) + ', like you planned</a>';
    return '<button type="button" class="btn primary big" data-ci="ride">' + ico('car') + 'Book a ride home</button>';
  }

  function emergencyBtn() {
    return '<button type="button" class="btn danger e112" data-ci="112" aria-label="Emergency: call ' + R.EMERGENCY_NUMBER + '">' + ico('alert') + R.EMERGENCY_NUMBER + '</button>';
  }

  /** Confirm step so 112 can't be dialled by accident. */
  function confirmEmergency() {
    var num = R.EMERGENCY_NUMBER;
    var m = openModal('<div class="sheet-grip" aria-hidden="true"></div><h2>Call ' + num + '?</h2>' +
      '<p class="muted">This calls India’s emergency number. Use it if you or someone with you is hurt or in danger.</p>' +
      '<div class="stack"><a class="btn danger big" href="' + R.emergencyUrl() + '" id="e-yes">' + ico('phone') + 'Yes, call ' + num + '</a>' +
      '<button type="button" class="btn secondary big" data-close autofocus>Cancel</button></div>', { label: 'Call ' + num + '?', sheet: true, night: true });
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
      ? 'If you don’t answer, <b>' + esc(p.contact.name) + '</b> gets a message. You agreed to this while sober.'
      : 'You chose not to alert anyone, so nobody will be contacted.';
  }

  /** Returns { main, actions }: content up top, the thumb-zone actions pinned at the bottom. */
  function checkinBody(c, p) {
    var name = esc(p.name), cname = esc(p.contact.name);
    var pair = '<div class="pair">' +
      '<a class="btn secondary" data-ci="call" href="' + esc(telLink(p.contact.phone)) + '">' + ico('phone') + 'Call ' + cname + '</a>' +
      '<a class="btn secondary" data-ci="text" href="' + esc(smsLink(p.contact.phone, askForRideText(p))) + '">' + ico('message') + 'Text ' + cname + '</a></div>';
    if (c.stage === 'asking') {
      var left = Math.max(0, Math.ceil((c.deadline - Date.now()) / 1000));
      var total = p.settings.checkinTimeout;
      return {
        main: '<div class="ci-ring" data-level="count" role="timer" aria-label="Seconds left to answer">' + I.eye({ level: 'count', progress: left / total }) +
            '<div><span class="num" id="ci-secs">' + left + '</span><span class="unit">seconds</span></div></div>' +
          '<h2 id="ci-title">Hey ' + name + '. Just checking in.</h2>' +
          '<div class="sr-only" aria-live="assertive" id="ci-live"></div>' +
          '<p class="ci-consent">' + consentLine(p) + '</p>' +
          (c.note ? '<p class="ci-note">' + esc(c.note) + '</p>' : '') +
          planHtml(p, getNight(), 'the check-in', true) +
          '<p class="ci-reason small">Why now: ' + esc(c.reason) + '</p>',
        actions: primaryRideBtn(p, 'the check-in') + pair +
          '<button type="button" class="btn quiet" data-ci="prove">I’m okay: take a 15-second test</button>'
      };
    }
    if (c.stage === 'proving') {
      return {
        main: '<h2 id="ci-title">Quick reaction test</h2>' +
          '<p class="ci-reason">Tap the moment it turns green. 5 rounds. The countdown is paused.</p>' +
          '<div class="ci-test"></div>',
        actions: '<button type="button" class="btn secondary" data-ci="back">Back</button>'
      };
    }
    if (c.stage === 'alerted') {
      var pushed = !!c.pushed;
      return {
        main: '<div class="ci-icon" data-level="high">' + I.eye({ level: 'high' }) + '</div>' +
          '<h2 id="ci-title">' + (pushed ? 'We let ' + cname + ' know' : 'Time to let ' + cname + ' know') + '</h2>' +
          '<p class="ci-reason">You didn’t answer, so, as you agreed while sober, SecondLook ' + (pushed ? 'sent this message:' : 'wrote this message for you:') + '</p>' +
          (c.alertText ? '<blockquote class="alert-text">' + esc(c.alertText) + '</blockquote>' : '<p class="muted">Preparing the message…</p>') +
          (!pushed && c.pushTried ? '<p class="small muted">The encrypted alert couldn’t be delivered (no connection?). Send it by SMS or WhatsApp below.</p>' : '') +
          (pushed ? '<p class="small muted">' + cname + ' got a notification. The details were end-to-end encrypted.' +
            (c.alertText ? ' <a data-ci="send-wa" target="_blank" rel="noopener" href="' + esc(waLink(p.contact.phone, c.alertText)) + '">Send it on WhatsApp too</a>' : '') + '</p>' : '') +
          (!pushed && !c.pushTried && c.alertText ? '<p class="small muted">Browsers can’t send texts on their own, so this opens your SMS app with the message ready. Turn on real notifications in Settings for next time.</p>' : ''),
        actions: pushed
          ? '<button type="button" class="btn primary big" data-ci="ride">' + ico('car') + 'Book a ride home</button>' +
            '<div class="pair"><a class="btn secondary" data-ci="call" href="' + esc(telLink(p.contact.phone)) + '">' + ico('phone') + 'Call ' + cname + '</a>' +
            (c.alertText ? '<a class="btn secondary" data-ci="send-sms" href="' + esc(smsLink(p.contact.phone, c.alertText)) + '">' + ico('message') + 'Also text</a>' : '') + '</div>' +
            '<button type="button" class="btn quiet" data-ci="close">I’m safe, close this</button>'
          : (c.alertText ? '<a class="btn primary big" data-ci="send-sms" href="' + esc(smsLink(p.contact.phone, c.alertText)) + '">' + ico('message') + 'Send it by SMS</a>' : '') +
            '<div class="pair">' + (c.alertText ? '<a class="btn secondary" data-ci="send-wa" target="_blank" rel="noopener" href="' + esc(waLink(p.contact.phone, c.alertText)) + '">WhatsApp</a>' : '') +
            '<a class="btn secondary" data-ci="call" href="' + esc(telLink(p.contact.phone)) + '">' + ico('phone') + 'Call ' + cname + '</a></div>' +
            '<div class="pair"><button type="button" class="btn secondary" data-ci="ride">' + ico('car') + 'Ride home</button>' +
            '<button type="button" class="btn quiet" data-ci="close">I’m safe</button></div>'
      };
    }
    if (c.stage === 'expired') {
      return {
        main: '<div class="ci-icon" data-level="ok">' + I.eye({ level: 'ok' }) + '</div>' +
          '<h2 id="ci-title">Nobody was contacted</h2>' +
          '<p class="ci-reason">You chose not to alert anyone. If you need a hand getting home, it’s all here.</p>' +
          planHtml(p, getNight(), 'the check-in', true),
        actions: primaryRideBtn(p, 'the check-in') + pair +
          '<button type="button" class="btn quiet" data-ci="close">Close</button>'
      };
    }
    return {
      main: '<div class="ci-icon" data-level="ok">' + I.eye({ level: 'ok' }) + '</div>' +
        '<h2 id="ci-title">Good call, ' + name + '</h2>' +
        '<p class="ci-reason">' + esc(c.note || 'Thanks for answering.') + '</p>' +
        planHtml(p, getNight(), 'the check-in', true) +
        '<div class="help-inline">' + helpHtml(p) + '</div>',
      actions: '<button type="button" class="btn secondary big" data-ci="close">Close</button>'
    };
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
    var body = checkinBody(c, p);
    root.innerHTML = '<div class="checkin" data-mode="night" role="alertdialog" aria-modal="true" aria-labelledby="ci-title"><div class="ci-screen">' +
      '<div class="ci-top"><span class="brand">' + I.eye({ level: 'ok' }) + 'SecondLook</span>' + emergencyBtn() + '</div>' +
      '<div class="ci-main"><div class="ci-replies" aria-live="assertive"></div>' + body.main + '</div>' +
      '<div class="ci-actions">' + body.actions + '</div>' +
      '</div></div>';

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
    } else if (act === 'ride-plan') {
      // the link opens the ride app; then record the answer
      setTimeout(function () { if (c.stage === 'asking' || c.stage === 'expired') respondCheckin('You opened your ride home, like you planned.'); }, 0);
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
    if (ring) I.setProgress($('.eye', ring), left / (p.settings.checkinTimeout * 1000));
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
    box.innerHTML = '<div class="reply-banner"><p><b>' + esc(p.contact.name) + ' ' + REPLY_TEXT[last.action] + '</b> – ' + esc(fmtTime(last.at)) + '</p>' +
      (c.thanked ? '<p class="small">You replied: “Thanks, I’m staying put.”</p>' : '<button type="button" class="btn secondary full" data-ci="thanks">Thanks, I’m staying put</button>') + '</div>';
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
  var LOG_ICONS = { night: 'moon', extension: 'puzzle', setup: 'user', baseline: 'pulse', nudge: 'eye', checkin: 'clock', alert: 'alert', check: 'pulse', settings: 'sliders', ride: 'car', contact: 'phone', data: 'download', action: 'check' };

  /** A "night" runs from 6am to 6am, so 1:30am belongs to the evening before. */
  function nightLabel(ts) {
    var d = new Date(ts - 6 * HOUR);
    var today = new Date(Date.now() - 6 * HOUR);
    if (d.toDateString() === today.toDateString()) return 'Tonight';
    var y = new Date(today); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Last night';
    return 'The night of ' + d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function renderLog(root) {
    var entries = S.get('log', []);
    var groups = [];
    entries.forEach(function (e) {
      var k = nightLabel(e.at);
      if (!groups.length || groups[groups.length - 1].label !== k) groups.push({ label: k, items: [] });
      groups[groups.length - 1].items.push(e);
    });
    root.innerHTML = '<div class="page">' +
      '<div class="log-head"><div><h1>Transparency log</h1>' +
      '<p class="lead">Everything SecondLook does is written here in plain words. Nothing happens behind your back.</p></div></div>' +
      '<div class="btn-row"><button class="btn primary" id="log-dl">' + ico('download') + 'Download my log</button>' +
      '<button class="btn secondary" id="log-import">' + ico('upload') + 'Import extension log</button>' +
      '<button class="btn quiet" id="log-clear">Clear log</button></div>' +
      (groups.length ? groups.map(function (g) {
        return '<section class="log-night"><h2>' + esc(g.label) + '</h2><ol class="log">' + g.items.map(function (e) {
          return '<li data-type="' + esc(e.type) + '"><span class="log-ico">' + ico(LOG_ICONS[e.type] || 'check') + '</span><div><p>' + esc(e.text) + '</p>' +
            '<time datetime="' + new Date(e.at).toISOString() + '">' + esc(fmtTime(e.at)) + '</time></div></li>';
        }).join('') + '</ol></section>';
      }).join('') : '<p class="muted">Nothing yet.</p>') +
      '<section class="section"><h2>Your data</h2><ul class="data-notes">' +
        '<li>' + ico('check') + '<span>Your baseline, settings and this log are stored only in this browser.</span></li>' +
        '<li>' + ico('check') + '<span>Typing analysis looks at timing and corrections, runs on your device, and nothing is uploaded.</span></li>' +
        '<li>' + ico('check') + '<span>The only thing that can leave your device is an alert you agreed to in advance.</span></li>' +
        '<li>' + ico('check') + '<span>Safety settings lock for a few hours after something is flagged, so a drunk you can’t quietly undo a sober decision.</span></li>' +
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
      '<p class="muted">In the extension popup, tap <b>Copy log for the web app</b> and paste it here, or choose the downloaded file. Entries are added to this log so you have one complete record.</p>' +
      '<label class="sr-only" for="log-code">Extension log code</label><textarea id="log-code" class="code" rows="4" placeholder="SLL1…"></textarea>' +
      '<p class="form-error" role="alert" id="log-import-err"></p>' +
      '<div class="btn-row"><button type="button" class="btn primary" id="log-import-go">Import entries</button>' +
      '<label class="btn secondary file-btn">Choose a file<input type="file" accept=".json,application/json" id="log-file"></label>' +
      '<button type="button" class="btn quiet" data-close>Cancel</button></div>', { label: 'Import extension log' });
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
      '<button type="button" class="btn secondary full" data-close>Cancel</button>',
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
    var m = openModal('<h2>Unlock with a quick test</h2>' +
      '<p class="muted">Something was flagged in the last few hours, so the rules you set while sober are locked. A 15-second reaction test unlocks them for 15 minutes.</p>' +
      '<div class="unlock-test"></div><p class="form-error" id="unlock-msg" role="alert"></p>' +
      '<button type="button" class="btn secondary full" data-close>Cancel</button>',
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
    var lockTag = locked ? '<span class="locked-tag">' + ico('lock') + 'Locked</span>' : '';
    var unlockAt = (function () {
      var fl = recentFlags(LOCK_WINDOW);
      var last = fl.reduce(function (m, f) { return Math.max(m, f.at); }, 0);
      return last ? fmtTime(last + LOCK_WINDOW) : '';
    })();
    var groups = [['set-you', 'You and your contact'], ['set-rides', 'Rides home'], ['set-alerts', 'Alerts to your contact'], ['set-ext', 'Browser extension'], ['set-baseline', 'Baseline'], ['set-data', 'Your data']];
    root.innerHTML = '<div class="page wide">' +
      '<h1>Settings</h1>' +
      (locked ? '<div class="lock-band lock" role="status">' + ico('lock') + '<div><h2>Locked' + (unlockAt ? ' until ' + esc(unlockAt) : ' for now') + '</h2>' +
        '<p>Something was flagged tonight, so the rules you set while sober can’t be changed right now. That’s the point: a drunk you can’t quietly switch them off.</p>' +
        '<button type="button" class="btn primary" id="unlock">' + ico('unlock') + 'Unlock with a 15-second test</button></div></div>' : '') +
      '<div class="settings">' +
      '<nav class="settings-nav" aria-label="Settings sections">' + groups.map(function (g) { return '<button type="button" data-jump="' + g[0] + '">' + esc(g[1]) + '</button>'; }).join('') + '</nav>' +
      '<div class="settings-body">' +
      '<section class="set-group" id="set-you"><h2>You and your contact' + lockTag + '</h2>' +
      '<form id="settings-form" novalidate><fieldset class="plain"' + (locked ? ' disabled' : '') + '>' +
        profileFields(p, false) +
        '<fieldset><legend>How SecondLook responds</legend>' +
          '<label class="field"><span>Sensitivity</span><select name="sensitivity">' +
            opt('gentle', s.sensitivity, 'Gentle: only big changes') + opt('balanced', s.sensitivity, 'Balanced (recommended)') + opt('protective', s.sensitivity, 'Protective: speak up sooner') +
          '</select></label>' +
          '<div class="row2">' +
            '<label class="field"><span>A prompt waits</span><select name="nudgeTimeout">' + [20, 30, 45, 60, 90].map(function (v) { return opt(v, s.nudgeTimeout, v + ' seconds'); }).join('') + '</select></label>' +
            '<label class="field"><span>A check-in waits</span><select name="checkinTimeout">' + [30, 60, 90, 120, 180].map(function (v) { return opt(v, s.checkinTimeout, v + ' seconds'); }).join('') + '</select></label>' +
          '</div>' +
        '</fieldset>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn primary big" type="submit">Save changes</button>' +
      '</fieldset></form></section>' +
      homeCard(p, locked, lockTag) +
      contactLinkCard(p, locked, lockTag) +
      '<section class="set-group" id="set-ext"><h2>Browser extension</h2>' +
        '<p class="muted">The SecondLook extension for Chrome and Edge gives the same second look on WhatsApp Web, Instagram DMs and Gmail. Paste this code into its popup. It holds timing numbers and your settings, never messages.</p>' +
        '<button type="button" class="btn secondary" id="ext-export"' + (b ? '' : ' disabled') + '>' + ico('puzzle') + 'Show my extension code</button>' +
        '<div id="ext-code-wrap" hidden><label class="sr-only" for="ext-code">Extension code</label><textarea id="ext-code" class="code" rows="4" readonly></textarea>' +
        '<div class="btn-row"><button type="button" class="btn secondary" id="ext-copy">Copy the code</button><button type="button" class="btn quiet" id="ext-dl">Download it as a file</button></div>' +
        (location.protocol === 'file:' ? '<p class="small muted">You opened SecondLook as a local file, so the extension can’t open it for check-ins. Use <code>npm start</code> or your GitHub Pages link, then export again.</p>' : '') +
        '</div></section>' +
      '<section class="set-group" id="set-baseline"><h2>Baseline' + lockTag + '</h2><p class="muted">Recalibrate if you changed phones or your baseline feels off. Do it sober.</p>' +
        '<button type="button" class="btn secondary" id="recal"' + (locked ? ' disabled' : '') + '>Recalibrate (2 minutes)</button></section>' +
      '<section class="set-group" id="set-data"><h2>Your data' + (locked && !p.demo ? lockTag : '') + '</h2><div class="danger-zone"><p class="muted">Delete your profile, baseline, messages and log from this browser. This can’t be undone.</p>' +
        '<button type="button" class="btn danger" id="reset"' + (locked && !p.demo ? ' disabled' : '') + '>' + ico('trash') + 'Delete all my data</button></div></section>' +
      '</div></div></div>';
    $$('[data-jump]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = $('#' + btn.getAttribute('data-jump'), root);
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        var h = $('h2', target); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
      });
    });

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
    return '<section class="night-card night">' +
      '<h2 class="sr-only">Your Night Out plan</h2>' +
      planHtml(p, n, 'your Night Out card') +
      '<p class="small muted">' + (next ? 'Next check-in at ' + esc(fmtTime(next)) + '. ' : 'No more check-ins tonight. ') +
        'Sensitivity is one step higher tonight (' + esc(sensitivityNow(p)) + ').</p>' +
      '<div class="btn-row"><button type="button" class="btn secondary" data-act="home-safe">' + ico('home') + 'I’m home safe</button>' +
      (p.demo ? '<button type="button" class="btn quiet" data-act="night-demo-remind">' + ico('flask') + 'Trigger a check-in now</button>' : '') + '</div>' +
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
    var m = openModal('<h2>Going out tonight?</h2>' +
      '<p class="muted">Decide now, while you’re thinking clearly. Later tonight SecondLook shows you your own plan, not a lecture.</p>' +
      '<form id="night-form" novalidate>' +
        '<fieldset><legend class="label">How I’m getting home</legend>' +
          '<label class="choice"><input type="radio" name="mode" value="cab" checked><span>A cab</span></label>' +
          '<label class="choice"><input type="radio" name="mode" value="friend"><span>A friend drives me</span></label>' +
          '<label class="choice"><input type="radio" name="mode" value="walk"><span>Walking</span></label>' +
          '<label class="choice"><input type="radio" name="mode" value="stay"><span>Staying over</span></label>' +
        '</fieldset>' +
        '<label class="field" data-show="cab"><span>Which app?</span><select name="provider"><option value="uber">Uber</option><option value="ola">Ola</option><option value="rapido">Rapido</option></select></label>' +
        '<label class="field" data-show="friend" hidden><span>Who? <em>(leave empty for ' + cname + ')</em></span><input name="friend" maxlength="40" placeholder="' + cname + '"></label>' +
        '<div class="row2">' +
          '<label class="field"><span>Home by</span><input type="time" name="homeBy" value="' + defaultHomeBy() + '" required></label>' +
          '<label class="field"><span>Check in with me</span><select name="everyMin"><option value="60">Every hour</option><option value="90" selected>Every 90 minutes</option><option value="120">Every 2 hours</option><option value="0">No check-ins</option></select></label>' +
        '</div>' +
        '<label class="field"><span>A note to later-tonight me <em>(optional)</em></span><textarea name="note" rows="2" maxlength="120" placeholder="Don’t drive, ' + esc(p.name) + '. Seriously."></textarea></label>' +
        '<label class="choice"><input type="checkbox" name="ntfy"><span>Also send the check-ins to <b>my own phone</b> through the free ntfy app. They only say “SecondLook check-in”.</span></label>' +
        '<p class="small muted">Browsers slow down background tabs, so in-app check-ins can arrive late. Allow notifications, or tick the ntfy option, to be reminded reliably.</p>' +
        '<p class="form-error" role="alert"></p>' +
        '<div class="step-nav"><button type="button" class="btn secondary" data-close>Cancel</button><button type="submit" class="btn primary big">Start my Night Out</button></div>' +
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
      return RL.publish(p.selfTopic, 'SecondLook check-in. Open the app and answer, it only takes a tap.', {
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
        '<div class="btn-row"><a class="btn primary" href="ntfy://ntfy.sh/' + esc(p.selfTopic) + '">Open in the ntfy app</a><a class="btn secondary" target="_blank" rel="noopener" href="https://ntfy.sh/' + esc(p.selfTopic) + '">Use ntfy in the browser</a></div>' +
        '<p class="small muted">Scheduled reminders can’t be cancelled, so if you get home early you may still get one. Just ignore it.</p>' +
        '<button type="button" class="btn quiet full" data-close>Done</button>', { label: 'Phone reminders' });
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
    reminderModal = openModal('<div class="sheet-grip" aria-hidden="true"></div><div class="nudge">' +
      I.eye({ level: 'count' }) +
      '<h2>How’s it going, ' + esc(p.name) + '?</h2>' +
      '<p>It’s ' + esc(fmtTime(Date.now())) + '. This is your Night Out check-in.</p>' +
      planHtml(p, n, 'a Night Out reminder', true) +
      '<div class="countdown"><p>Checking in with you properly in <b data-secs></b> seconds.</p><div class="timeout-bar"><span></span></div></div>' +
      '<div class="stack"><button type="button" class="btn primary big" data-r="ok" autofocus>I’m OK</button>' +
      (function () {
        var ride = planRide(p);
        return ride ? '<a class="btn secondary" data-r="home" data-ride-id="' + ride.id + '" data-ride-src="a Night Out reminder" href="' + esc(ride.url) + '" target="_blank" rel="noopener">' + ico('car') + 'Heading home: open ' + esc(ride.name) + '</a>'
          : '<button type="button" class="btn secondary" data-r="home">I’m heading home now</button>';
      })() + '</div>' +
      '<div class="sr-only" aria-live="polite" data-live></div></div>', {
        label: 'Night Out check-in',
        sheet: true, night: true,
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
      var what = b.getAttribute('data-r') === 'home' ? 'I’m heading home now' : 'I’m OK';
      // a ride link must finish opening before the dialog is removed
      setTimeout(function () { m.close('answered'); answerReminder(idx, what); }, 0);
    });
  }

  function answerReminder(idx, what) {
    updateNight(function (n) { if (n.reminders[idx]) { n.reminders[idx].status = 'done'; n.reminders[idx].answeredAt = Date.now(); } });
    log('night', 'You answered the Night Out check-in: “' + what + '”.');
    if (/heading home/.test(what)) toast('Safe trip. Tap “I’m home safe” when you’re in.');
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
    toast('Welcome home');
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

  function homeCard(p, locked, lockTag) {
    var has = p.home && R.hasCoords(p.home);
    return '<section class="set-group" id="set-rides"><h2>Rides home' + (lockTag || '') + '</h2>' +
      '<p class="muted">' + (p.homeAddress ? 'Home address: <b>' + esc(p.homeAddress) + '</b>. ' : 'No home address yet. Add it above. ') +
      (has ? 'Home location saved, so Uber opens with home as the destination.' : 'Save your home location once, while you’re at home, so Uber can open with home filled in. For Ola and Rapido we copy your address so you can paste it.') + '</p>' +
      '<p class="small muted">Your location is read by your browser and stored only on this device.</p>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="home-here"' + (locked ? ' disabled' : '') + '>' + ico('pin') + 'I’m at home: save this location</button>' +
      (has ? '<button type="button" class="btn quiet" id="home-clear"' + (locked ? ' disabled' : '') + '>Forget home location</button>' : '') + '</div>' +
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

  function contactLinkCard(p, locked, lockTag) {
    var cname = esc(p.contact.name);
    if (!p.link) {
      return '<section class="set-group" id="set-alerts"><h2>Alerts to your contact' + (lockTag || '') + '</h2>' +
        '<p class="muted">Browsers can’t send SMS by themselves. With an encrypted contact link, ' + cname + ' gets a real phone notification when an alert fires, and can tap “I’m on my way” so you see it on your screen.</p>' +
        '<ul class="data-notes small"><li>' + ico('shield') + '<span>Everything is end-to-end encrypted on your device. The relay (ntfy.sh) only sees a generic “' + esc(p.name) + ' may need help” notification.</span></li>' +
        '<li>' + ico('lock') + '<span>The key lives only in the link you share with ' + cname + '. Nothing is sent until an alert fires or you send a test.</span></li></ul>' +
        '<div class="btn-row"><button type="button" class="btn primary" id="link-create"' + (locked ? ' disabled' : '') + '>' + ico('link') + 'Set up real notifications</button></div></section>';
    }
    var url = contactPageUrl(p, true);
    var isFile = location.protocol === 'file:';
    var qr = '';
    try { qr = window.SLQR.toSvg(url, { label: 'QR code of the contact link for ' + p.contact.name }); } catch (e) { qr = ''; }
    return '<section class="set-group" id="set-alerts"><h2>Alerts to your contact</h2>' +
      '<p class="muted">Real notifications are on. Send this private link to <b>' + cname + '</b> once. Opening it saves the key on their phone and shows how to turn on notifications.</p>' +
      (isFile ? '<p class="form-error">You opened SecondLook as a local file, so this link won’t open on ' + cname + '’s phone. Host SecondLook (for example on GitHub Pages) and set up the link from there.</p>' : '') +
      '<div class="qr-row">' + (qr ? '<div class="qr">' + qr + '</div>' : '') +
      '<div class="qr-side"><label class="sr-only" for="link-url">Contact link</label><textarea id="link-url" class="code" rows="4" readonly>' + esc(url) + '</textarea>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="link-copy">Copy the link</button>' +
      '<a class="btn secondary" id="link-wa" target="_blank" rel="noopener" href="' + esc(waLink(p.contact.phone, shareText(p, url))) + '">Share on WhatsApp</a>' +
      '<a class="btn quiet" id="link-sms" href="' + esc(smsLink(p.contact.phone, shareText(p, url))) + '">Share by SMS</a></div></div></div>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="link-test">Send a test alert</button>' +
      '<button type="button" class="btn quiet" id="link-preview">Preview what ' + cname + ' sees</button></div>' +
      '<details class="more"><summary>Reset or turn off' + (lockTag || '') + '</summary><div class="more-body"><p class="muted">Resetting makes new keys. The old link stops working and you’ll need to share the new one.</p>' +
      '<div class="btn-row"><button type="button" class="btn secondary" id="link-reset"' + (locked ? ' disabled' : '') + '>Reset the link</button>' +
      '<button type="button" class="btn danger" id="link-off"' + (locked ? ' disabled' : '') + '>Turn off notifications</button></div></div></details>' +
      '</section>';
  }

  function shareText(p, url) {
    return 'Hi ' + p.contact.name + ', I added you as my safe contact in SecondLook. If I ever don’t answer a check-in on a night out, you’ll get an alert. Please open this link once on your phone. It saves a private key: ' + url;
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
    toast('Demo loaded. Try Messages next.');
  }

  // ======================================================================
  // boot
  // ======================================================================
  // The landing page's one orchestrated moment: a message gets typed, then paused.
  function renderWelcome(root) {
    var phone = $('.phone', root);
    if (!phone) return null;
    var compose = $('#pc-text', root), sheet = $('.phone-sheet', root), replay = $('.replay', root), quote = $('#pc-quote', root);
    var TEXT = 'heyy im fnie cna drive hme lol';
    var timers = [];
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function play() {
      clear();
      sheet.classList.remove('up');
      replay.hidden = true;
      quote.textContent = '“' + TEXT + '”';
      if (reduced) { compose.textContent = TEXT; sheet.classList.add('up'); replay.hidden = false; return; }
      compose.textContent = '';
      Array.from(TEXT).forEach(function (ch, i) {
        timers.push(setTimeout(function () { compose.textContent += ch; }, 500 + i * 75));
      });
      timers.push(setTimeout(function () { sheet.classList.add('up'); }, 500 + TEXT.length * 75 + 600));
      timers.push(setTimeout(function () { replay.hidden = false; }, 500 + TEXT.length * 75 + 1400));
    }
    replay.addEventListener('click', play);
    play();
    return function () { clear(); replay.removeEventListener('click', play); };
  }

  var RENDER = { welcome: renderWelcome, setup: renderSetup, calibrate: renderCalibrate, home: renderHome, chat: renderChat, check: renderCheck, log: renderLog, settings: renderSettings };

  function init() {
    $$('[data-go]').forEach(function (el) { el.addEventListener('click', function () { go(el.getAttribute('data-go')); }); });
    $$('[data-demo]').forEach(function (el) { el.addEventListener('click', loadDemo); });
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
