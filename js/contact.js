/* SecondLook — the safe contact's page (contact.html).
 * Opened from the shared link (…/contact.html?a=<alert>&r=<reply>#k=<key>) or later from
 * the ntfy notification (same URL without the key; the key was saved on first open). */
(function () {
  'use strict';

  var SEC = window.SLSecure, RL = window.SLRelay, R = window.SLRides;
  var STORE = 'secondlook.contact.v1';
  var MAX_AGE = 12 * 3600e3;
  var memory = {};

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function loadLinks() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return memory; } }
  function saveLinks(o) { memory = o; try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* memory only */ } }

  // ---------- which link is this? ----------
  var parsed = SEC.parseContactUrl(location.search, location.hash);
  var link = null;
  if (parsed.alertTopic && parsed.replyTopic) {
    var links = loadLinks();
    if (parsed.key) {
      links[parsed.alertTopic] = { a: parsed.alertTopic, r: parsed.replyTopic, k: parsed.key, savedAt: Date.now(), name: (links[parsed.alertTopic] || {}).name || '' };
      saveLinks(links);
      // Take the key out of the address bar (and history) once it's saved on this device.
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }
    var rec = links[parsed.alertTopic];
    if (rec && rec.r === parsed.replyTopic) link = rec;
  }

  var state = { alert: null, statuses: [], replies: [], conn: 'connecting', decryptFailed: false, sending: false, sent: null, showRides: false, confirm112: false };

  function name() { return (state.alert && state.alert.name) || (link && link.name) || 'your friend'; }

  function setConn(s) {
    state.conn = s;
    $('conn').textContent = s === 'open' ? '● Listening' : s === 'offline' ? '○ Offline' : '○ Reconnecting…';
    $('conn').className = 'conn ' + s;
    renderBanner();
  }

  function renderBanner() {
    var html = '';
    if (state.conn === 'offline' || (state.conn === 'reconnecting' && !navigator.onLine)) {
      html = '<div class="card warn">You’re offline, so new alerts can’t arrive here. If ' + esc(name()) + ' needs you, they can still reach you by SMS, WhatsApp or a call.</div>';
    } else if (state.conn === 'reconnecting') {
      html = '<div class="card warn">Can’t reach the alert service right now — retrying. Their SMS/WhatsApp fallback still works.</div>';
    }
    if (state.decryptFailed) {
      html += '<div class="card warn">An alert arrived but couldn’t be unlocked on this device. Ask ' + esc(name()) + ' to share their SecondLook link with you again.</div>';
    }
    $('banner').innerHTML = html;
  }

  function reasonLine(a) {
    if (a.status === 'test') return 'This is a test — ' + esc(a.name) + ' is checking that alerts reach you. Nothing is wrong.';
    return esc(a.reason || 'They didn’t answer a check-in in time.') + ' While sober, they agreed that you should be told.';
  }

  function rideList(a) {
    var home = a.home || {};
    var opts = R.rideOptions({ address: home.address, home: SLRides.hasCoords(home) ? { lat: home.lat, lng: home.lng } : null });
    return '<div class="rides">' + opts.map(function (o) {
      return '<a class="ride" href="' + esc(o.url) + '" target="_blank" rel="noopener" data-ride="' + o.id + '">' + esc(o.name) + '</a>';
    }).join('') + '</div>' +
      (home.address ? '<p class="small muted">Their home: ' + esc(home.address) + (opts[0].prefilled ? ' (Uber opens with it filled in)' : ' — we’ll copy it so you can paste it as the destination.') + '</p>'
        : '<p class="small muted">They haven’t shared a home address, so enter the destination in the app.</p>');
  }

  function render() {
    var c = $('content');
    if (!link) {
      c.innerHTML = '<h1>Safe contact</h1>' +
        '<div class="card"><p>This page needs the private link your friend sent you from SecondLook — the one that ends with a long code after <code>#k=</code>.</p>' +
        '<p class="muted">If you opened this from a notification, open their original link once on this device first. It stores a private key here so future alerts can be unlocked.</p></div>';
      return;
    }
    var a = state.alert && Date.now() - state.alert.at < MAX_AGE ? state.alert : null;
    var html = '';
    if (a) {
      var isTest = a.status === 'test';
      var loc = typeof a.loc === 'string' && /^https:\/\/maps\.google\.com\/\?q=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(a.loc) ? a.loc : '';
      html += '<section class="alert-card card ' + (isTest ? 'test' : 'urgent') + '">' +
        '<p class="eyebrow">' + (isTest ? 'Test alert' : 'Alert') + ' · ' + esc(fmtTime(a.at)) + '</p>' +
        '<h1>' + (isTest ? esc(a.name) + ' sent a test' : esc(a.name) + ' may need help') + '</h1>' +
        '<p>' + reasonLine(a) + '</p>' +
        (loc ? '<p><a class="btn secondary" href="' + esc(loc) + '" target="_blank" rel="noopener">📍 Open their location</a></p>' : (isTest ? '' : '<p class="small muted">They chose not to share their location.</p>')) +
        '</section>';
      if (!isTest) {
        var phone = a.phone ? R.telUrl(a.phone) : '';
        html += '<section class="card"><h2>Let ' + esc(a.name) + ' know you’re on it</h2>' +
          '<p class="small muted">Your answer shows up on their screen right away.</p>' +
          '<div class="ci-actions">' +
            (phone ? '<a class="btn primary big" href="' + esc(phone) + '" data-reply="calling">📞 I’m calling now</a>'
                   : '<button type="button" class="btn primary big" data-reply="calling">📞 I’m calling now</button>') +
            '<button type="button" class="btn secondary big" data-reply="on_my_way">🚗 I’m on my way</button>' +
            '<button type="button" class="btn secondary big" data-reply="booking_cab">🚕 Can’t come – book them a cab</button>' +
          '</div>' +
          (state.showRides ? '<div class="help-inline">' + rideList(a) + '</div>' : '') +
          (state.sent ? '<p class="sent" role="status">' + esc(state.sent) + '</p>' : '') +
          (!phone ? '<p class="small muted">They didn’t add a phone number to SecondLook — use your own contacts to call them.</p>' : '') +
          '</section>' +
          '<section class="card"><h2>Emergency</h2>' +
          (state.confirm112
            ? '<p>Call <b>112</b> now? Use this only if you think they’re in danger.</p><div class="row-btns"><a class="btn danger big" href="' + esc(R.emergencyUrl()) + '" data-e="call">Yes, call 112</a><button type="button" class="btn ghost" data-e="cancel">Cancel</button></div>'
            : '<button type="button" class="btn danger" data-e="ask">🆘 Call 112</button>') +
          '</section>';
      }
    } else {
      html += '<h1>You’re ' + esc(name()) + '’s safe contact 💙</h1>' +
        '<div class="card"><p>No alerts right now. If ' + esc(name()) + ' doesn’t respond to a SecondLook check-in, you’ll see it here.</p>' +
        '<p class="small muted">Keep this page open, or turn on notifications below so you hear about it even when it’s closed.</p></div>';
    }
    if (state.statuses.length) {
      html += '<section class="card"><h2>From ' + esc(name()) + '</h2><ul class="updates">' + state.statuses.slice(-5).reverse().map(function (s) {
        return '<li>' + esc(s.text) + ' <time>' + esc(fmtTime(s.at)) + '</time></li>';
      }).join('') + '</ul></section>';
    }
    if (state.replies.length) {
      html += '<p class="small muted">Your last answer: ' + esc(replyWord(state.replies[state.replies.length - 1].action)) + ' · ' + esc(fmtTime(state.replies[state.replies.length - 1].at)) + '</p>';
    }
    html += '<section class="card"><h2>Get a notification when it matters</h2>' +
      '<ol class="steps-list">' +
        '<li>Install the free <b>ntfy</b> app (<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener">Android</a> · <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">iPhone</a>).</li>' +
        '<li>Subscribe to this private topic: <code class="topic">' + esc(link.a) + '</code> <button type="button" class="linkish" data-copy-topic>Copy</button></li>' +
      '</ol>' +
      '<div class="row-btns"><a class="btn secondary" href="ntfy://ntfy.sh/' + esc(link.a) + '">Open in ntfy app</a>' +
      '<a class="btn ghost" href="https://ntfy.sh/' + esc(link.a) + '" target="_blank" rel="noopener">Use ntfy in the browser</a></div>' +
      '<p class="small muted">The notification only says “' + esc(name()) + ' may need help – tap to open”. The details are encrypted and only unlock on this page.</p>' +
      '</section>';
    c.innerHTML = html;
  }

  function replyWord(action) {
    return action === 'calling' ? 'I’m calling now' : action === 'on_my_way' ? 'I’m on my way' : action === 'booking_cab' ? 'I’m booking you a cab' : action;
  }

  // ---------- incoming ----------
  function onMessage(m) {
    if (!SEC.isCiphertext(m.message)) return; // plain messages (e.g. the generic notification) aren't for this page
    SEC.decrypt(link.k, m.message).then(function (obj) {
      if (!obj || typeof obj.t !== 'string' || typeof obj.at !== 'number') return;
      if (obj.t === 'alert') {
        if (!state.alert || obj.at >= state.alert.at) {
          var isNew = !state.alert || obj.at > state.alert.at;
          state.alert = obj;
          state.decryptFailed = false;
          if (obj.name && link.name !== obj.name) { link.name = obj.name; var all = loadLinks(); if (all[link.a]) { all[link.a].name = obj.name; saveLinks(all); } }
          if (isNew && Date.now() - obj.at < MAX_AGE) {
            $('live').textContent = obj.status === 'test' ? 'Test alert from ' + obj.name : obj.name + ' may need help. ' + (obj.reason || '');
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
          }
        }
      } else if (obj.t === 'status') {
        state.statuses.push({ text: String(obj.text || '').slice(0, 200), at: obj.at });
        state.statuses.sort(function (x, y) { return x.at - y.at; });
        $('live').textContent = String(obj.text || '');
      } else if (obj.t === 'reply') {
        state.replies.push({ action: obj.action, at: obj.at });
      }
      render();
    }, function () {
      state.decryptFailed = true;
      renderBanner();
    });
  }

  // ---------- outgoing ----------
  function sendReply(action) {
    if (state.sending) return;
    state.sending = true;
    var payload = { t: 'reply', action: action, at: Date.now(), from: (state.alert && state.alert.contactName) || '' };
    SEC.encrypt(link.k, payload).then(function (ct) { return RL.publish(link.r, ct); }).then(function (ok) {
      state.sending = false;
      state.sent = ok ? 'Sent ✓ — ' + name() + ' will see “' + replyWord(action) + '” on their screen.'
                      : 'Couldn’t send your answer (no connection?). Call or text them directly instead.';
      if (ok) state.replies.push({ action: action, at: payload.at });
      render();
    });
  }

  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-reply]');
    if (r) {
      var action = r.getAttribute('data-reply');
      if (action === 'booking_cab') state.showRides = true;
      sendReply(action); // a tel: link keeps its default action and opens the dialer
      return;
    }
    var ride = e.target.closest('[data-ride]');
    if (ride && state.alert && state.alert.home && state.alert.home.address) {
      var opt = R.rideById(ride.getAttribute('data-ride'), { address: state.alert.home.address, home: R.hasCoords(state.alert.home) ? state.alert.home : null });
      if (opt && opt.copyAddress) R.copyText(state.alert.home.address).then(function (ok) { if (ok) { state.sent = 'Home address copied – paste it as the destination.'; render(); } });
      return;
    }
    var em = e.target.closest('[data-e]');
    if (em) {
      var act = em.getAttribute('data-e');
      if (act === 'ask') { state.confirm112 = true; render(); var yes = document.querySelector('[data-e="call"]'); if (yes) yes.focus(); }
      else if (act === 'cancel') { state.confirm112 = false; render(); }
      else if (act === 'call') { setTimeout(function () { state.confirm112 = false; render(); }, 0); }
      return;
    }
    if (e.target.closest('[data-copy-topic]')) {
      R.copyText(link.a).then(function (ok) { e.target.textContent = ok ? 'Copied ✓' : 'Select and copy it'; });
    }
  });

  // ---------- start ----------
  render();
  if (link) {
    setConn('connecting');
    RL.subscribe([SEC.dataTopic(link.a), link.r], Math.floor((Date.now() - MAX_AGE) / 1000), onMessage, setConn);
    window.addEventListener('offline', function () { setConn('offline'); });
    window.addEventListener('online', function () { setConn('reconnecting'); });
  } else {
    $('conn').textContent = '';
  }
})();
