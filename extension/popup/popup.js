/* SecondLook extension popup. */
(function () {
  'use strict';

  var SH = self.SLShare;
  var LOCK_WINDOW = 6 * 3600e3;
  // Must match manifest.json content_scripts[0].js
  var CONTENT_FILES = ['lib/words.js',  'lib/metrics.js',  'lib/rides.js',  'src/selectors.js',  'lib/icons.js',  'src/overlay.js',  'src/content.js'];
  var BUILTIN = [
    { id: 'whatsapp', label: 'WhatsApp Web', hosts: ['web.whatsapp.com'] },
    { id: 'instagram', label: 'Instagram DMs', hosts: ['www.instagram.com', 'instagram.com'] },
    { id: 'gmail', label: 'Gmail', hosts: ['mail.google.com'] }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(ts) { return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function log(text, type) { return chrome.runtime.sendMessage({ type: 'log', entry: { type: type || 'extension', text: text } }).catch(function () {}); }
  function scriptId(origin) { return 'sl-' + origin.replace(/[^a-z0-9]/gi, '_'); }

  var state = {}, tab = null;

  function locked() {
    var flags = (state.flags || []).filter(function (f) { return Date.now() - f.at < LOCK_WINDOW; });
    return flags.length > 0 || Date.now() < ((state.baseline && state.baseline.lockUntil) || 0);
  }

  function renderStatus() {
    var el = $('status'), title, text, cls;
    var n = (state.flags || []).filter(function (f) { return Date.now() - f.at < LOCK_WINDOW; }).length;
    if (!state.baseline) { cls = 'off'; title = 'Not set up yet'; text = 'Import your baseline below to turn SecondLook on.'; }
    else if (Date.now() < (state.pausedUntil || 0)) { cls = 'off'; title = 'Paused until ' + fmtTime(state.pausedUntil); text = 'Messages aren’t being checked right now.'; }
    else if (n >= 3) { cls = 'high'; title = 'Please don’t drive tonight'; text = n + ' messages looked very different from your usual in the last few hours.'; }
    else if (n) { cls = 'caution'; title = n + (n === 1 ? ' message looked' : ' messages looked') + ' off tonight'; text = 'If you’ve been drinking, pick a ride home.'; }
    else { cls = ''; title = 'All quiet'; text = 'Watching quietly. Only typing rhythm is used — never your words.'; }
    el.className = 'status ' + cls;
    $('status-title').textContent = title;
    $('status-text').textContent = text;
  }

  function renderMain() {
    var b = state.baseline;
    $('import-card').hidden = !!b;
    $('main-card').hidden = !b;
    if (!b) return;
    $('baseline-info').textContent = 'Baseline for ' + (b.name || 'you') + ', imported ' + fmt(b.importedAt || b.exportedAt) + '. Learned from ' + (b.learned || 0) + ((b.learned || 0) === 1 ? ' message' : ' messages') + ' since.';
    var paused = Date.now() < (state.pausedUntil || 0);
    var btn = $('pause-btn');
    btn.textContent = paused ? 'Resume now' : 'Pause for 1 hour';
    btn.disabled = !paused && locked();
    $('pause-note').textContent = !paused && locked() ? 'Pausing is locked: something was flagged in the last 6 hours. The plan you made sober stays on.' : '';
    $('app-url').value = b.appUrl || '';
  }

  function renderSites() {
    var sites = state.sites || {};
    var html = BUILTIN.map(function (s) {
      return '<label class="site"><span>' + esc(s.label) + '</span><input type="checkbox" data-site="' + s.id + '"' + (sites[s.id] !== false ? ' checked' : '') + '></label>';
    }).join('');
    var custom = state.custom || [];
    custom.forEach(function (o) {
      html += '<label class="site"><span>' + esc(o.replace(/^https?:\/\//, '')) + '</span><input type="checkbox" data-origin="' + esc(o) + '" checked></label>';
    });
    if (tab && /^https?:/.test(tab.url || '')) {
      var u = new URL(tab.url);
      var builtin = BUILTIN.some(function (s) { return s.hosts.indexOf(u.hostname) >= 0; });
      if (!builtin && custom.indexOf(u.origin) < 0) {
        html += '<label class="site"><span>Also use on <b>' + esc(u.hostname) + '</b></span><input type="checkbox" data-origin="' + esc(u.origin) + '"></label>';
      }
    }
    $('sites').innerHTML = html;
  }

  function renderLog() {
    var entries = (state.log || []).slice(0, 20);
    $('log').innerHTML = entries.length ? entries.map(function (e) {
      return '<li>' + esc(e.text) + '<time>' + esc(fmt(e.at)) + '</time></li>';
    }).join('') : '<li class="muted">Nothing yet.</li>';
  }

  function render() { renderStatus(); renderMain(); renderSites(); renderLog(); }

  function load() {
    return chrome.storage.local.get(null).then(function (r) { state = r || {}; render(); });
  }

  function importCode(raw) {
    var err = $('import-error'); err.textContent = '';
    try {
      if (state.baseline && locked()) throw new Error('Can’t replace the baseline while something is flagged. Try again tomorrow.');
      var b = SH.validateBaselineExport(SH.decodeCode(raw, SH.BASELINE_PREFIX));
      b.importedAt = Date.now();
      b.learned = 0;
      var night = b.nightOut; delete b.nightOut;
      return chrome.storage.local.set({ baseline: b, nightOut: night }).then(function () {
        log('Imported the baseline from ' + (b.name || 'your') + '’s SecondLook web app (exported ' + fmt(b.exportedAt) + '). Only timing numbers were imported.');
        $('import-code').value = '';
        return load();
      });
    } catch (e) {
      err.textContent = e.message;
      $('import-card').hidden = false;
      return Promise.resolve();
    }
  }

  // ---------- events ----------
  $('import-btn').addEventListener('click', function () { importCode($('import-code').value); });
  $('import-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    f.text().then(importCode);
    this.value = '';
  });

  $('pause-btn').addEventListener('click', function () {
    var paused = Date.now() < (state.pausedUntil || 0);
    if (!paused && locked()) return;
    var until = paused ? 0 : Date.now() + 3600e3;
    chrome.storage.local.set({ pausedUntil: until }).then(function () {
      log(paused ? 'You resumed SecondLook.' : 'You paused SecondLook for 1 hour (until ' + fmtTime(until) + ').');
      return load();
    });
  });

  $('open-app').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'openApp', path: 'home' }).catch(function () {});
    window.close();
  });

  $('sites').addEventListener('change', function (e) {
    var input = e.target;
    if (input.dataset.site) {
      var sites = Object.assign({}, state.sites || {});
      sites[input.dataset.site] = input.checked;
      var label = BUILTIN.filter(function (s) { return s.id === input.dataset.site; })[0].label;
      chrome.storage.local.set({ sites: sites }).then(function () {
        log('You turned SecondLook ' + (input.checked ? 'on' : 'off') + ' for ' + label + '.');
        return load();
      });
      return;
    }
    var origin = input.dataset.origin;
    if (!origin) return;
    var pattern = origin + '/*';
    if (input.checked) {
      // permissions.request must run inside the click; don't await anything before it.
      chrome.permissions.request({ origins: [pattern] }).then(function (granted) {
        if (!granted) { input.checked = false; return; }
        return chrome.scripting.registerContentScripts([{ id: scriptId(origin), matches: [pattern], js: CONTENT_FILES, runAt: 'document_idle' }])
          .catch(function () { /* already registered */ })
          .then(function () {
            var custom = (state.custom || []).filter(function (o) { return o !== origin; }).concat([origin]);
            return chrome.storage.local.set({ custom: custom });
          })
          .then(function () {
            if (tab && tab.url && tab.url.indexOf(origin) === 0) {
              return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }).catch(function () {});
            }
          })
          .then(function () { log('You turned SecondLook on for ' + origin + '.'); return load(); });
      });
    } else {
      chrome.scripting.unregisterContentScripts({ ids: [scriptId(origin)] }).catch(function () {})
        .then(function () { return chrome.permissions.remove({ origins: [pattern] }).catch(function () {}); })
        .then(function () { return chrome.storage.local.set({ custom: (state.custom || []).filter(function (o) { return o !== origin; }) }); })
        .then(function () { log('You turned SecondLook off for ' + origin + '.'); return load(); });
    }
  });

  function logCode() { return SH.encodeCode(SH.LOG_PREFIX, SH.buildLogExport(state.log || [])); }
  $('copy-log').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText(logCode()).then(function () {
      btn.textContent = 'Copied ✓';
      setTimeout(function () { btn.textContent = 'Copy log for the web app'; }, 1800);
    }, function () { btn.textContent = 'Copy failed — use Download'; });
  });
  $('dl-log').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(SH.buildLogExport(state.log || []), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'secondlook-extension-log.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('save-url').addEventListener('click', function () {
    var v = $('app-url').value.trim(), err = $('adv-error');
    err.textContent = '';
    if (!state.baseline) { err.textContent = 'Import a baseline first.'; return; }
    if (!/^(https?|file):\/\//.test(v)) { err.textContent = 'Use a full address starting with https://'; return; }
    var b = Object.assign({}, state.baseline, { appUrl: v });
    chrome.storage.local.set({ baseline: b }).then(function () { log('You set the web app address to ' + v + '.'); return load(); });
  });
  $('replace-baseline').addEventListener('click', function () {
    var err = $('adv-error');
    if (locked()) { err.textContent = 'Locked while something is flagged.'; return; }
    $('import-card').hidden = false;
    $('import-code').focus();
  });

  chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { tab = tabs && tabs[0]; }).catch(function () {}).then(load);
})();
