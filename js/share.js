/* SecondLook — sharing helpers between the web app and the browser extension.
 * Pure functions, no DOM. Copied into extension/lib by `npm run build:ext`.
 *
 * Privacy: exports contain numbers (baseline statistics), settings and names you typed
 * into setup. Never message text. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLShare = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASELINE_PREFIX = 'SLB1.';
  var LOG_PREFIX = 'SLL1.';
  var LOCK_WINDOW = 6 * 3600e3;
  var CHAT_KEYS = ['ikiMs', 'ikiCv', 'backspaceRate', 'pauseRate', 'oddWordRate'];

  function utf8ToB64url(str) {
    var b64 = typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToUtf8(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return typeof atob === 'function'
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf8');
  }

  function encodeCode(prefix, obj) { return prefix + utf8ToB64url(JSON.stringify(obj)); }

  /** Accepts "PREFIX.base64" or plain JSON. Returns the object or throws a friendly Error. */
  function decodeCode(input, prefix) {
    var s = String(input || '').trim();
    if (!s) throw new Error('Nothing to import.');
    if (s.charAt(0) === '{' || s.charAt(0) === '[') return JSON.parse(s);
    if (s.indexOf(prefix) !== 0) throw new Error('That doesn’t look like a SecondLook code.');
    try { return JSON.parse(b64urlToUtf8(s.slice(prefix.length))); }
    catch (e) { throw new Error('The code is incomplete or damaged — copy it again.'); }
  }

  function isStat(st) {
    return !!st && typeof st.n === 'number' && st.n >= 1 && isFinite(st.mean) && isFinite(st.m2);
  }

  function buildBaselineExport(opts) {
    var b = opts.baseline, p = opts.profile;
    var chat = {};
    CHAT_KEYS.forEach(function (k) { if (isStat(b.chat && b.chat[k])) chat[k] = { n: b.chat[k].n, mean: b.chat[k].mean, m2: b.chat[k].m2 }; });
    var lastFlag = (opts.flags || []).reduce(function (m, f) { return Math.max(m, f.at || 0); }, 0);
    return {
      kind: 'secondlook-baseline', v: 1,
      exportedAt: opts.now || Date.now(),
      appUrl: opts.appUrl || '',
      name: p.name || '',
      contactName: (p.contact && p.contact.name) || '',
      homeAddress: p.homeAddress || '',
      home: p.home && isFinite(p.home.lat) && isFinite(p.home.lng) ? { lat: p.home.lat, lng: p.home.lng } : null,
      settings: {
        sensitivity: (p.settings && p.settings.sensitivity) || 'balanced',
        nudgeTimeout: (p.settings && p.settings.nudgeTimeout) || 45
      },
      chat: chat,
      reactionMs: isStat(b.test && b.test.reactionMs) ? { n: b.test.reactionMs.n, mean: b.test.reactionMs.mean, m2: b.test.reactionMs.m2 } : null,
      lockUntil: lastFlag ? lastFlag + LOCK_WINDOW : 0,
      nightOut: opts.nightOut && opts.nightOut.homeBy ? {
        startedAt: opts.nightOut.startedAt, homeBy: opts.nightOut.homeBy,
        planText: String(opts.nightOut.planText || '').slice(0, 160), note: String(opts.nightOut.note || '').slice(0, 120)
      } : null
    };
  }

  /** Returns a cleaned baseline export, or throws with a reason a person can act on. */
  function validateBaselineExport(o) {
    if (!o || o.kind !== 'secondlook-baseline') throw new Error('This isn’t a SecondLook baseline code.');
    if (o.v !== 1) throw new Error('This code comes from a different version of SecondLook.');
    var chat = {};
    CHAT_KEYS.forEach(function (k) { if (isStat(o.chat && o.chat[k])) chat[k] = o.chat[k]; });
    if (Object.keys(chat).length < 3) throw new Error('The baseline is missing typing data. Finish calibration in the web app first.');
    var sens = ['gentle', 'balanced', 'protective'].indexOf(o.settings && o.settings.sensitivity) >= 0 ? o.settings.sensitivity : 'balanced';
    var nudge = Number(o.settings && o.settings.nudgeTimeout);
    var appUrl = /^(https?|file):\/\//.test(String(o.appUrl || '')) ? String(o.appUrl) : '';
    return {
      kind: o.kind, v: 1,
      exportedAt: Number(o.exportedAt) || 0,
      appUrl: appUrl,
      name: String(o.name || '').slice(0, 40),
      contactName: String(o.contactName || '').slice(0, 40),
      homeAddress: String(o.homeAddress || '').slice(0, 140),
      home: o.home && isFinite(o.home.lat) && isFinite(o.home.lng) ? { lat: Number(o.home.lat), lng: Number(o.home.lng) } : null,
      settings: { sensitivity: sens, nudgeTimeout: nudge >= 10 && nudge <= 300 ? nudge : 45 },
      chat: chat,
      reactionMs: isStat(o.reactionMs) ? o.reactionMs : null,
      lockUntil: Number(o.lockUntil) || 0,
      nightOut: o.nightOut && isFinite(o.nightOut.homeBy) && isFinite(o.nightOut.startedAt) ? {
        startedAt: Number(o.nightOut.startedAt), homeBy: Number(o.nightOut.homeBy), endedAt: null,
        planText: String(o.nightOut.planText || '').slice(0, 160), note: String(o.nightOut.note || '').slice(0, 120)
      } : null
    };
  }

  function buildLogExport(entries, now) {
    return { kind: 'secondlook-extension-log', v: 1, exportedAt: now || Date.now(), entries: (entries || []).slice(0, 500) };
  }

  /**
   * Merge extension log entries into the web app log. Adds a "[Extension]" prefix,
   * drops malformed entries and duplicates, and returns { log, added }.
   */
  function mergeLogs(existing, imported, cap) {
    var list = Array.isArray(imported) ? imported : imported && Array.isArray(imported.entries) ? imported.entries : null;
    if (!list) throw new Error('This isn’t a SecondLook extension log.');
    var seen = {};
    (existing || []).forEach(function (e) { seen[e.at + '|' + e.text] = true; });
    var out = (existing || []).slice(), added = 0;
    list.forEach(function (e) {
      if (!e || typeof e.at !== 'number' || !isFinite(e.at) || typeof e.text !== 'string') return;
      var text = e.text.slice(0, 500);
      if (text.indexOf('[Extension] ') !== 0) text = '[Extension] ' + text;
      var key = e.at + '|' + text;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ at: e.at, type: 'extension', text: text });
      added++;
    });
    out.sort(function (a, b) { return b.at - a.at; });
    return { log: out.slice(0, cap || 600), added: added };
  }

  return {
    BASELINE_PREFIX: BASELINE_PREFIX, LOG_PREFIX: LOG_PREFIX, CHAT_KEYS: CHAT_KEYS,
    utf8ToB64url: utf8ToB64url, b64urlToUtf8: b64urlToUtf8,
    encodeCode: encodeCode, decodeCode: decodeCode,
    buildBaselineExport: buildBaselineExport, validateBaselineExport: validateBaselineExport,
    buildLogExport: buildLogExport, mergeLogs: mergeLogs
  };
});
