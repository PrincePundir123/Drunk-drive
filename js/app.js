/* SecondLook — app controller.
 * Views: welcome → setup (while sober) → calibrate (baseline) → home / messages / check / log / settings.
 * Escalation: message nudge → check-in overlay → (if you agreed in advance) alert your safe contact. */
(function () {
  'use strict';

  var M = window.SLMetrics;
  var T = window.SLTests;
  var S = window.SLStore;
  var DICT = new Set(String(window.SL_WORDS || '').split(/\s+/).filter(Boolean));

  var HOUR = 3600e3;
  var LOCK_WINDOW = 6 * HOUR;        // settings stay locked this long after a flag
  var UNLOCK_WINDOW = 15 * 60e3;     // passing a check unlocks settings for this long
  var SENSITIVITY = { gentle: 65, balanced: 55, protective: 45 };
  var DEFAULT_SETTINGS = { nudgeTimeout: 45, checkinTimeout: 60, sensitivity: 'balanced', ntfyTopic: '' };
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
  function smsLink(phone, body) { return 'sms:' + phoneClean(phone) + '?&body=' + encodeURIComponent(body); }
  function waLink(phone, body) { return 'https://wa.me/' + phoneClean(phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(body); }
  function telLink(phone) { return 'tel:' + phoneClean(phone); }
  function rideLinks(p) {
    var home = ((p && p.homeAddress) || '').trim();
    var uber = 'https://m.uber.com/ul/?action=setPickup&pickup=my_location';
    if (home) uber += '&dropoff[formatted_address]=' + encodeURIComponent(home);
    return [
      { name: 'Uber', url: uber },
      { name: 'Ola', url: 'https://book.olacabs.com/' },
      { name: 'Rapido', url: 'https://www.rapido.bike/' },
      { name: 'Lyft', url: 'https://ride.lyft.com/' },
      { name: 'Taxis near me', url: 'https://www.google.com/maps/search/taxi+near+me' }
    ];
  }
  function askForRideText(p) {
    return 'Hey ' + p.contact.name + ", I've been drinking and I don't think I should drive. Could you help me get home?";
  }
  function helpHtml(p) {
    var rides = rideLinks(p).map(function (r) {
      return '<a class="ride" href="' + esc(r.url) + '" target="_blank" rel="noopener" data-log-type="ride" data-log="Opened ' + esc(r.name) + ' to find a ride home">' + esc(r.name) + '</a>';
    }).join('');
    var ask = askForRideText(p);
    return '<div class="help">' +
      '<h3>Get a ride</h3><div class="rides">' + rides + '</div>' +
      '<h3>Or ask ' + esc(p.contact.name) + '</h3>' +
      '<div class="contact-actions">' +
        '<a class="btn secondary" href="' + esc(smsLink(p.contact.phone, ask)) + '" data-log-type="contact" data-log="Texted ' + esc(p.contact.name) + ' for a ride">💬 Text</a>' +
        '<a class="btn secondary" href="' + esc(waLink(p.contact.phone, ask)) + '" target="_blank" rel="noopener" data-log-type="contact" data-log="Messaged ' + esc(p.contact.name) + ' on WhatsApp">WhatsApp</a>' +
        '<a class="btn secondary" href="' + esc(telLink(p.contact.phone)) + '" data-log-type="contact" data-log="Called ' + esc(p.contact.name) + '">📞 Call</a>' +
      '</div></div>';
  }
  function openHelp() {
    var p = getProfile();
    if (!p) return;
    var m = openModal('<h2>Get home safe 💙</h2><p class="muted">Leaving the car is always the right call.' +
      (p.homeAddress ? ' Uber will open with your home address filled in.' : '') + '</p>' + helpHtml(p) +
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
    var first = modal.el.querySelector('[autofocus], button, [href], input, textarea, select');
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
    if (location.hash !== '#/' + v) history.replaceState(null, '', '#/' + v);
    currentView = v;
    renderView(true);
  }
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
        '<label class="check"><input type="checkbox" name="shareLocation"' + checked(p.consent.shareLocation) + '><span>Include my location in that alert.</span></label>' +
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
      consent: { notifyOnTimeout: !!fd.get('notifyOnTimeout'), shareLocation: !!fd.get('shareLocation') }
    };
    if (!out.name) return { error: 'Please add your first name.' };
    if (!out.contact.name) return { error: 'Add your safe contact’s name.' };
    if (!validPhone(out.contact.phone)) return { error: 'Add a valid phone number for your safe contact (7–15 digits, with country code).' };
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
    var t = {};
    t.reactionMs = M.fromSamples(res.reaction.trials);
    t.trackingErr = M.fromSamples([res.tracking.trackingErr]);
    M.TYPING_KEYS.forEach(function (k) {
      t[k] = M.fromSamples(res.typing.map(function (s) { return s[k]; }));
    });
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
      '<section class="status card level-' + level + '" aria-live="polite"><span class="status-dot" aria-hidden="true"></span><div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div></section>' +
      (p.demo ? '<section class="card demo-card"><h2>🧪 Demo mode</h2><p>This profile has a pre-made baseline so you can explore right away. Try this:</p><ol>' +
        '<li>Open <a href="#/chat">Messages</a> and tap <b>Simulate an impaired message</b> — or type slowly with lots of corrections.</li>' +
        '<li>Ignore the prompt and watch SecondLook check in, then alert the (fictional) safe contact.</li>' +
        '<li>See every step in the <a href="#/log">Transparency log</a>.</li></ol>' +
        '<div class="row-btns"><button class="btn secondary" data-act="own-baseline">Use my own baseline</button><button class="btn ghost" data-act="exit-demo">Exit demo</button></div></section>' : '') +
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
        '<dt>Instant push alerts</dt><dd>' + (s.ntfyTopic ? 'On' : 'Off') + '</dd>' +
        '<dt>You agreed to this</dt><dd>' + esc(fmtDate(p.consent.agreedAt)) + '</dd>' +
      '</dl><a class="linkish" href="#/settings">Change in settings →</a></section>' +
      '<section class="card"><h2>Your sober baseline</h2>' + baselineGrid(b) +
        '<p class="muted small">Created ' + esc(ago(b.createdAt)) + ' · learned from ' + (b.learned || 0) + ' of your sober messages.</p></section>' +
      '<section class="card"><h2>Tonight</h2>' +
        (lc ? '<p>Last quick check: <b>' + lc.score + '/100</b> (' + esc(levelWord(lc.level)) + ') · ' + esc(ago(lc.at)) + '</p>' : '<p class="muted">No quick checks in the last few hours.</p>') +
        (flags.length ? '<ul class="flags">' + flags.slice().reverse().map(function (f) {
          return '<li>' + (f.source === 'message' ? 'A message looked different' : 'A quick check looked different') + ' · ' + f.score + '/100 · ' + esc(fmtTime(f.at)) + '</li>';
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
      var threshold = SENSITIVITY[getProfile().settings.sensitivity] || 55;
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
        '<blockquote class="nudge-msg">' + esc(text) + '</blockquote>' +
        (reasons.length ? '<details><summary>What’s different?</summary><ul>' + reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<div class="stack">' +
          '<button type="button" class="btn primary" data-n="edit">Edit message</button>' +
          '<button type="button" class="btn secondary" data-n="send">Send anyway</button>' +
          '<button type="button" class="btn ghost" data-n="check">Check how I’m doing (1 min)</button>' +
        '</div>' +
        '<div class="timeout"><div class="timeout-bar"><span></span></div>' +
        '<p class="tiny">If there’s no answer in <b data-secs>' + secs + '</b>s, SecondLook will check in with you.</p></div>' +
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
    var bar = $('.timeout-bar span', modal.el), secsEl = $('[data-secs]', modal.el);
    timer = setInterval(function () {
      var left = secs * 1000 - (Date.now() - t0);
      bar.style.width = Math.max(0, left / (secs * 10)) + '%';
      secsEl.textContent = Math.max(0, Math.ceil(left / 1000));
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
        var typing = M.averageSamples(res.typing, M.TYPING_KEYS);
        var sample = Object.assign({ reactionMs: res.reaction.reactionMs, trackingErr: res.tracking.trackingErr }, typing);
        showResult(M.compare(sample, b.test, M.TEST_KEYS), false);
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
    st.checkin = null;
    saveState(st);
    log('checkin', 'Check-in closed.');
    showCheckin();
    if (currentView === 'home' || currentView === 'settings') renderView(false);
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
      return '<div class="ci-ring" style="--val:' + Math.round(left / total * 100) + '"><span id="ci-secs">' + left + '</span><small>sec</small></div>' +
        '<h2 id="ci-title">Hey ' + name + ', just checking in 💙</h2>' +
        '<p class="muted">' + esc(c.reason) + '</p>' +
        (c.note ? '<p class="ci-note">' + esc(c.note) + '</p>' : '') +
        '<p class="ci-consent">' + consentLine(p) + '</p>' +
        '<div class="ci-actions">' +
          '<button type="button" class="btn primary big" data-ci="ride">🚗 Get a ride home</button>' + contactBtns +
          '<button type="button" class="btn ghost big" data-ci="prove">✅ I’m okay — 15-second check</button>' +
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
        '</div>' +
        (!pushed && c.pushTried ? '<p class="tiny muted">The instant push alert couldn’t be delivered (no connection?). Use the SMS button above.</p>' : '') +
        (!pushed && !c.pushTried && c.alertText ? '<p class="tiny muted">Prototype note: browsers can’t send texts silently, so this opens your SMS app with the alert pre-written. Turn on <b>instant push alerts</b> in Settings to notify ' + cname + ' automatically.</p>' : '');
    }
    if (c.stage === 'expired') {
      return '<div class="ci-icon" aria-hidden="true">🤍</div>' +
        '<h2 id="ci-title">No problem — nobody was contacted</h2>' +
        '<p class="muted">You chose not to auto-alert anyone. If you need a hand getting home, it’s all right here.</p>' +
        '<div class="ci-actions"><button type="button" class="btn primary big" data-ci="ride">🚗 Get a ride home</button>' + contactBtns +
        '<button type="button" class="btn ghost" data-ci="close">Close</button></div>';
    }
    // responded
    return '<div class="ci-icon" aria-hidden="true">💙</div>' +
      '<h2 id="ci-title">Good call, ' + name + '</h2>' +
      '<p class="muted">' + esc(c.note || 'Thanks for answering.') + '</p>' +
      '<div class="help-inline">' + helpHtml(p) + '</div>' +
      '<button type="button" class="btn ghost full" data-ci="close">Close</button>';
  }

  function showCheckin() {
    var root = $('#checkin-root');
    var st = getState(), c = st.checkin, p = getProfile();
    if (checkinWidget) { checkinWidget.destroy(); checkinWidget = null; }
    if (!c || !p) {
      stopCheckinTimer();
      root.hidden = true;
      root.innerHTML = '';
      document.body.classList.remove('no-scroll');
      return;
    }
    root.hidden = false;
    document.body.classList.add('no-scroll');
    root.innerHTML = '<div class="checkin level-' + (c.stage === 'alerted' ? 'high' : 'caution') + '" role="alertdialog" aria-modal="true" aria-labelledby="ci-title"><div class="checkin-inner">' + checkinBody(c, p) + '</div></div>';

    if (c.stage === 'proving') {
      checkinWidget = T.reactionTest($('.ci-test', root), { trials: 5, onDone: function (r) { finishProve(r); } });
    }
    if (c.stage === 'asking') startCheckinTimer(); else stopCheckinTimer();
    if (c.stage === 'alerted' && !c.alertText && !alertInFlight) sendAlert();
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
    if (secsEl) secsEl.textContent = Math.max(0, Math.ceil(left / 1000));
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

  function pushNtfy(topic, title, body) {
    var url = 'https://ntfy.sh/' + encodeURIComponent(topic) + '?title=' + encodeURIComponent(title) + '&priority=urgent&tags=rotating_light';
    return fetch(url, { method: 'POST', body: body }).then(function (r) { return r.ok; }).catch(function () { return false; });
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
      var topic = (p.settings.ntfyTopic || '').trim();
      if (topic) {
        var ok = await pushNtfy(topic, 'SecondLook: ' + p.name + ' may need help', text);
        updateCheckin(function (c) { c.pushed = ok; c.pushTried = true; });
        log('alert', ok ? 'Instant push alert delivered to ' + p.contact.name + '.' : 'The instant push alert couldn’t be delivered — the SMS button is ready instead.');
        showCheckin();
      }
    } finally {
      alertInFlight = false;
    }
  }

  // ======================================================================
  // view: transparency log
  // ======================================================================
  var LOG_ICONS = { setup: '📝', baseline: '📏', nudge: '👀', checkin: '💙', alert: '📣', check: '🩺', settings: '🔒', ride: '🚗', contact: '💬', data: '🗂️', action: '•' };

  function renderLog(root) {
    var entries = S.get('log', []);
    root.innerHTML = '<div class="container">' +
      '<h1>Transparency log</h1>' +
      '<p class="lead">Everything SecondLook does is written here, in plain words. Nothing happens behind your back.</p>' +
      '<div class="row-btns"><button class="btn secondary" id="log-dl">Download my log</button><button class="btn ghost" id="log-clear">Clear log</button></div>' +
      (entries.length ? '<ol class="log">' + entries.map(function (e) {
        return '<li><span class="log-ico" aria-hidden="true">' + (LOG_ICONS[e.type] || '•') + '</span><div><p>' + esc(e.text) + '</p><time datetime="' + new Date(e.at).toISOString() + '">' + esc(fmtDate(e.at)) + '</time></div></li>';
      }).join('') + '</ol>' : '<p class="muted">Nothing yet.</p>') +
      '<section class="card"><h2>Your data</h2><ul class="ticks">' +
        '<li>Your baseline, messages and this log are stored <b>only in this browser</b>.</li>' +
        '<li>Typing analysis looks at <b>timing and corrections</b>, runs on your device, and nothing is uploaded.</li>' +
        '<li>The only thing that can ever leave your device is an alert <b>you agreed to</b> in advance.</li>' +
        '<li>Safety settings lock for a few hours after something is flagged, so an impaired you can’t quietly undo a sober decision.</li>' +
      '</ul></section></div>';
    $('#log-dl', root).addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(S.get('log', []), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'secondlook-log.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('#log-clear', root).addEventListener('click', function () {
      if (isLocked()) { openUnlock(function () { renderView(false); }); return; }
      if (!confirm('Clear the whole log?')) return;
      S.set('log', []);
      log('data', 'You cleared the log.');
    });
  }

  // ======================================================================
  // view: settings (locked after a flag — the "sober you decides" rule)
  // ======================================================================
  function randomTopic() {
    var bytes = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return 'secondlook-' + Array.from(bytes).map(function (x) { return (x % 36).toString(36); }).join('');
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
        '<fieldset class="group"><legend>Instant push alerts (optional)</legend>' +
          '<p class="hint">Browsers can’t send SMS on their own. For truly automatic alerts, your safe contact installs the free <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a> app and subscribes to your private topic. Only the alert text is sent, and only when an alert fires.</p>' +
          '<label class="field"><span>Your private topic</span><input name="ntfyTopic" maxlength="64" placeholder="secondlook-…" value="' + esc(s.ntfyTopic) + '"></label>' +
          '<div class="row-btns"><button type="button" class="btn ghost" id="gen-topic">Generate a private topic</button><button type="button" class="btn ghost" id="test-push">Send a test alert</button></div>' +
        '</fieldset>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn primary big full" type="submit">Save changes</button>' +
      '</fieldset></form>' +
      '<section class="card"><h2>Baseline</h2><p class="muted">Recalibrate if you changed phones or your baseline feels off. Do it sober.</p>' +
        '<button type="button" class="btn secondary" id="recal"' + (locked ? ' disabled' : '') + '>Recalibrate (2 min)</button></section>' +
      '<section class="card danger"><h2>Delete everything</h2><p class="muted">Removes your profile, baseline, messages and log from this browser.</p>' +
        '<button type="button" class="btn danger" id="reset"' + (locked && !p.demo ? ' disabled' : '') + '>Delete all my data</button></section>' +
      '</div>';

    var form = $('#settings-form', root);
    var unlockBtn = $('#unlock', root);
    if (unlockBtn) unlockBtn.addEventListener('click', function () { openUnlock(function () { renderView(false); }); });

    $('#gen-topic', root).addEventListener('click', function () { form.elements.ntfyTopic.value = randomTopic(); });
    $('#test-push', root).addEventListener('click', function () {
      var topic = form.elements.ntfyTopic.value.trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(topic)) { toast('Generate or enter a topic first (letters, numbers, - and _).'); return; }
      var btn = this; btn.disabled = true;
      pushNtfy(topic, 'SecondLook test', 'Test from ' + p.name + '’s SecondLook app. If you got this, you’ll be alerted if ' + p.name + ' ever needs help getting home.')
        .then(function (ok) {
          btn.disabled = false;
          toast(ok ? 'Test alert sent ✓' : 'Couldn’t reach ntfy.sh — check your connection.');
          log('settings', ok ? 'Sent a test push alert to topic ' + topic + '.' : 'A test push alert failed to send.');
        });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isLocked() && b) { toast('Settings are locked right now.'); return; }
      var r = readProfileForm(form, false);
      var err = $('.form-error', form);
      if (r.error) { err.textContent = r.error; return; }
      var topic = String(form.elements.ntfyTopic.value || '').trim();
      if (topic && !/^[A-Za-z0-9_-]{6,64}$/.test(topic)) { err.textContent = 'The push topic can only use letters, numbers, - and _ (6–64 characters).'; return; }
      err.textContent = '';
      var old = getProfile();
      var np = Object.assign({}, old, r.data);
      np.settings = {
        sensitivity: form.elements.sensitivity.value,
        nudgeTimeout: Number(form.elements.nudgeTimeout.value),
        checkinTimeout: Number(form.elements.checkinTimeout.value),
        ntfyTopic: topic
      };
      np.consent = Object.assign({}, r.data.consent, { agreedAt: old.consent.agreedAt });
      var changes = [];
      if (old.contact.name !== np.contact.name || old.contact.phone !== np.contact.phone) changes.push('safe contact is now ' + np.contact.name);
      if (old.consent.notifyOnTimeout !== np.consent.notifyOnTimeout) { changes.push('auto-alert turned ' + (np.consent.notifyOnTimeout ? 'ON' : 'OFF')); np.consent.agreedAt = Date.now(); }
      if (old.consent.shareLocation !== np.consent.shareLocation) { changes.push('location sharing turned ' + (np.consent.shareLocation ? 'ON' : 'OFF')); np.consent.agreedAt = Date.now(); }
      if (old.settings.sensitivity !== np.settings.sensitivity) changes.push('sensitivity set to ' + np.settings.sensitivity);
      if (old.settings.nudgeTimeout !== np.settings.nudgeTimeout || old.settings.checkinTimeout !== np.settings.checkinTimeout) changes.push('wait times ' + np.settings.nudgeTimeout + ' s / ' + np.settings.checkinTimeout + ' s');
      if ((old.settings.ntfyTopic || '') !== topic) changes.push('instant push alerts ' + (topic ? 'ON' : 'OFF'));
      if (old.name !== np.name) changes.push('name updated');
      if (old.homeAddress !== np.homeAddress) changes.push('home address updated');
      saveProfile(np);
      if (changes.length) log('settings', 'You changed settings: ' + changes.join('; ') + '.');
      toast(changes.length ? 'Saved ✓' : 'No changes');
      renderView(false);
    });

    $('#recal', root).addEventListener('click', function () { go('calibrate'); });
    $('#reset', root).addEventListener('click', function () {
      if (confirm('Delete everything SecondLook stored in this browser? This can’t be undone.')) resetAll();
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
      settings: { nudgeTimeout: 20, checkinTimeout: 30, sensitivity: 'balanced', ntfyTopic: '' }
    });
    saveBaseline({
      createdAt: now - 2 * 86400e3, learned: 12,
      test: { reactionMs: s(320, 45, 10), trackingErr: s(6, 1.5, 3), ikiMs: s(190, 35, 4), ikiCv: s(0.6, 0.12, 4), backspaceRate: s(0.08, 0.05, 4), pauseRate: s(0.2, 0.3, 4), typoRate: s(0.03, 0.02, 4) },
      chat: { ikiMs: s(210, 45, 12), ikiCv: s(0.65, 0.15, 12), backspaceRate: s(0.09, 0.06, 12), pauseRate: s(0.5, 0.5, 12), oddWordRate: s(0.06, 0.06, 12) }
    });
    saveState({ flags: [], lastCheck: null, checkin: null, unlockedAt: 0 });
    chatMemory = [];
    S.set('log', [
      { at: now - 2 * 86400e3 + 60e3, type: 'baseline', text: '[Demo] You created your sober baseline. Reaction 320 ms, tracking error 6.0%.' },
      { at: now - 2 * 86400e3, type: 'setup', text: '[Demo] You set up SecondLook. Safe contact: Priya. Auto-alert on no response: ON. Share location: OFF.' }
    ]);
    log('data', 'Demo profile loaded (fictional user “Alex” and safe contact “Priya”).');
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
    });
    window.addEventListener('hashchange', route);

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

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ }); });
    }
  }

  init();
})();
