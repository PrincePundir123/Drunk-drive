/* SecondLook extension — background service worker.
 * Owns the extension's storage writes (log, flags, learning) so tabs can't race each
 * other, and opens the web app when something needs escalating. No network use. */
importScripts('../lib/metrics.js');

var M = self.SLMetrics;
var HOUR = 3600e3;
var LOCK_WINDOW = 6 * HOUR;
var REASONS = { 'ext-ignored': 1, 'ext-repeated': 1, 'ext-strong': 1 };
var APP_PATHS = { home: 1, check: 1 };

var queue = Promise.resolve();
function serial(fn) { queue = queue.then(fn, fn); return queue; }
function get(keys) { return chrome.storage.local.get(keys); }
function set(obj) { return chrome.storage.local.set(obj); }

function appendLog(entry) {
  return serial(function () {
    return get(['log']).then(function (r) {
      var log = r.log || [];
      log.unshift({ at: Date.now(), type: String(entry.type || 'extension').slice(0, 20), text: String(entry.text || '').slice(0, 500) });
      return set({ log: log.slice(0, 300) });
    });
  });
}

function updateBadge() {
  return get(['flags', 'pausedUntil', 'baseline']).then(function (r) {
    var n = (r.flags || []).filter(function (f) { return Date.now() - f.at < LOCK_WINDOW; }).length;
    var text = !r.baseline ? '?' : Date.now() < (r.pausedUntil || 0) ? '⏸' : n ? String(n) : '';
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: n >= 3 ? '#e11d48' : n ? '#d97706' : '#475569' });
  }).catch(function () { /* ignore */ });
}

function openApp(hashPath) {
  return get(['baseline']).then(function (r) {
    var base = r.baseline && r.baseline.appUrl;
    if (!base) {
      appendLog({ type: 'extension', text: 'Couldn’t open the SecondLook web app: import your baseline first so the extension knows where it lives.' });
      return false;
    }
    var url = base.split('#')[0] + '#/' + hashPath;
    return chrome.tabs.create({ url: url }).then(function () { return true; }, function () {
      appendLog({ type: 'extension', text: 'Couldn’t open the web app at ' + base + '. If you opened it as a local file, use `npm start` or the GitHub Pages link and export your baseline again.' });
      return false;
    });
  });
}

chrome.runtime.onInstalled.addListener(function (details) {
  get(['sites']).then(function (r) {
    if (!r.sites) set({ sites: { whatsapp: true, instagram: true, gmail: true }, custom: [], flags: [], pausedUntil: 0 });
  });
  if (details.reason === 'install') {
    appendLog({ type: 'extension', text: 'SecondLook extension installed. Import your baseline from the web app to turn it on.' });
  }
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener(function (changes) {
  if (changes.flags || changes.pausedUntil || changes.baseline) updateBadge();
});

var lastEscalation = 0;

chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  if (!msg || typeof msg.type !== 'string') return;
  // Only our own extension pages and content scripts can message us; nothing external.
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === 'log') {
    appendLog(msg.entry || {}).then(function () { reply({ ok: true }); });
    return true;
  }

  if (msg.type === 'flag') {
    serial(function () {
      return get(['flags']).then(function (r) {
        var flags = (r.flags || []).filter(function (f) { return Date.now() - f.at < 12 * HOUR; });
        flags.push({ at: Date.now(), score: Number(msg.score) || 0, site: String(msg.site || '').slice(0, 20) });
        return set({ flags: flags }).then(function () {
          reply({ recentHour: flags.filter(function (f) { return Date.now() - f.at < HOUR; }).length });
        });
      });
    });
    return true;
  }

  if (msg.type === 'learn') {
    serial(function () {
      return get(['baseline', 'flags']).then(function (r) {
        var b = r.baseline;
        if (!b || !msg.sample) return;
        var recent = (r.flags || []).some(function (f) { return Date.now() - f.at < LOCK_WINDOW; });
        if (recent || Date.now() < (b.lockUntil || 0)) return; // never learn on a flagged night
        M.CHAT_KEYS.forEach(function (k) {
          var v = msg.sample[k];
          if (typeof v === 'number' && isFinite(v)) b.chat[k] = M.push(b.chat[k], v);
        });
        b.learned = (b.learned || 0) + 1;
        return set({ baseline: b });
      });
    });
    return;
  }

  if (msg.type === 'escalate') {
    var reason = REASONS[msg.reason] ? msg.reason : 'ext-ignored';
    if (Date.now() - lastEscalation < 2 * 60e3) return; // one check-in tab at a time
    lastEscalation = Date.now();
    appendLog({ type: 'checkin', text: 'Opened the SecondLook check-in in a new tab (' + (reason === 'ext-ignored' ? 'a prompt was ignored' : reason === 'ext-repeated' ? 'several messages looked different' : 'a message looked very different') + ').' });
    openApp('home?checkin=' + reason);
    return;
  }

  if (msg.type === 'openApp') {
    var path = APP_PATHS[msg.path] ? msg.path : 'home';
    openApp(path).then(function (ok) { reply({ ok: ok }); });
    return true;
  }
});
