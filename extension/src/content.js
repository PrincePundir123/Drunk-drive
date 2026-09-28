/* SecondLook extension — content script.
 *
 * What it records: keystroke TIMING and COUNTS only (when a key changed the text, and
 * whether it added or deleted). At the moment you press send, the message text is read
 * once, in memory, to count misspelled words — then it goes out of scope. It is never
 * stored, logged or sent anywhere.
 *
 * Fail open: every handler is wrapped so that if anything throws, the site behaves
 * exactly as if SecondLook weren't installed and your message sends normally. */
(function () {
  'use strict';
  if (window.__secondLookLoaded) return;
  window.__secondLookLoaded = true;

  var M = self.SLMetrics, SEL = self.SLSelectors, UI = self.SLOverlay, RIDES = self.SLRides;
  if (!M || !SEL || !UI) return;
  var DICT = new Set(String(self.SL_WORDS || '').split(/\s+/).filter(Boolean));
  var SENS = { gentle: 65, balanced: 55, protective: 45 };
  var BUMP = { gentle: 'balanced', balanced: 'protective', protective: 'protective' };
  var site = SEL.detect(location);

  var cfg = { baseline: null, sites: {}, custom: [], pausedUntil: 0, nightOut: null };
  var drafts = new WeakMap();   // editor element -> { events, len, nudged }
  var lastEditor = null;
  var bypass = false;            // true while WE are re-sending after "Send anyway"
  var promptOpen = false;

  function load() {
    try {
      chrome.storage.local.get(['baseline', 'sites', 'custom', 'pausedUntil', 'nightOut'], function (r) {
        cfg.baseline = r.baseline || null;
        cfg.sites = r.sites || {};
        cfg.custom = r.custom || [];
        cfg.pausedUntil = r.pausedUntil || 0;
        cfg.nightOut = r.nightOut || null;
      });
    } catch (e) { /* extension reloaded; stay inert */ }
  }
  load();
  try { chrome.storage.onChanged.addListener(load); } catch (e) { /* ignore */ }

  function send(msg, cb) {
    try { chrome.runtime.sendMessage(msg, function (res) { void chrome.runtime.lastError; if (cb) cb(res); }); }
    catch (e) { if (cb) cb(null); }
  }
  function log(text, type) { send({ type: 'log', entry: { type: type || 'extension', text: text } }); }

  function enabled() {
    if (!cfg.baseline) return false;
    if (Date.now() < cfg.pausedUntil) return false;
    if (site.id === 'generic') return cfg.custom.indexOf(location.origin) >= 0;
    if (cfg.sites[site.id] === false) return false;
    return SEL.isActivePath(site, location);
  }

  function nightOutActive() {
    var n = cfg.nightOut;
    return !!(n && !n.endedAt && n.startedAt && Date.now() < (n.homeBy || 0) + 12 * 3600e3);
  }
  function threshold() {
    var s = (cfg.baseline.settings && cfg.baseline.settings.sensitivity) || 'balanced';
    if (nightOutActive()) s = BUMP[s] || s;
    return SENS[s] || 55;
  }

  // ---------- find the message box ----------
  function asElement(node) { return node && node.nodeType === 1 ? node : node && node.parentElement; }
  function editorFrom(node) {
    var el = asElement(node);
    if (!el || !el.closest) return null;
    if (site.composer) {
      for (var i = 0; i < site.composer.length; i++) {
        var hit = el.closest(site.composer[i]);
        if (hit) return hit;
      }
      return null;
    }
    // generic: a textarea, or the top of a contenteditable region
    if (el.tagName === 'TEXTAREA') return el;
    if (!el.isContentEditable) return null;
    while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
    return el;
  }
  function textLength(ed) { return ed.tagName === 'TEXTAREA' || ed.tagName === 'INPUT' ? ed.value.length : (ed.textContent || '').length; }
  function readText(ed) { return ed.tagName === 'TEXTAREA' || ed.tagName === 'INPUT' ? ed.value : (ed.innerText || ''); }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function clickable(el) { return el && (el.closest('button, [role="button"]') || el); }

  /** Nearest visible send button: search outward from the message box. */
  function findSendButton(ed) {
    var scope = ed, depth = 0;
    while (scope && depth < 14) {
      for (var i = 0; i < site.sendButton.length; i++) {
        var list = scope.querySelectorAll(site.sendButton[i]);
        for (var j = 0; j < list.length; j++) {
          var b = clickable(list[j]);
          if (visible(b)) return b;
        }
      }
      if (site.sendTexts.length) {
        var cands = scope.querySelectorAll('button, [role="button"]');
        for (var k = 0; k < cands.length; k++) {
          if (site.sendTexts.indexOf((cands[k].textContent || '').trim()) >= 0 && visible(cands[k])) return cands[k];
        }
      }
      scope = scope.parentElement;
      depth++;
    }
    return null;
  }
  function isSendButton(target) {
    var el = asElement(target);
    if (!el || !el.closest) return null;
    for (var i = 0; i < site.sendButton.length; i++) {
      var hit = el.closest(site.sendButton[i]);
      if (hit) return clickable(hit);
    }
    if (site.sendTexts.length) {
      var btn = el.closest('button, [role="button"]');
      if (btn && site.sendTexts.indexOf((btn.textContent || '').trim()) >= 0) return btn;
    }
    return null;
  }

  // ---------- timing-only recorder ----------
  function draft(ed) {
    var d = drafts.get(ed);
    if (!d) { d = { events: [], len: textLength(ed), nudged: false }; drafts.set(ed, d); }
    return d;
  }
  function resetDraft(ed) { drafts.set(ed, { events: [], len: textLength(ed), nudged: false }); }

  document.addEventListener('input', function (e) {
    try {
      var ed = editorFrom(e.target);
      if (!ed) return;
      lastEditor = ed;
      var d = draft(ed);
      var len = textLength(ed), diff = len - d.len;
      d.len = len;
      if (len === 0) { resetDraft(ed); return; } // cleared or sent
      var it = e.inputType || '';
      var kind = it.indexOf('delete') === 0 ? 'delete' : it.indexOf('insert') === 0 ? 'insert' : diff < 0 ? 'delete' : 'insert';
      d.events.push({ t: performance.now(), kind: kind, n: Math.max(1, Math.abs(diff)) });
      if (d.events.length > 3000) d.events.splice(0, d.events.length - 3000);
    } catch (err) { /* fail open */ }
  }, true);

  // ---------- scoring ----------
  function evaluate(ed) {
    var d = drafts.get(ed);
    if (!d || d.nudged) return null;
    var ks = M.analyzeKeystrokes(d.events);
    if (ks.chars < 12) return null;
    // The only moment text is read: counted here, never kept.
    var odd = M.oddWordRate(readText(ed), DICT, null);
    var sample = {
      ikiMs: ks.ikiMs, ikiCv: ks.ikiCv, backspaceRate: ks.backspaceRate, pauseRate: ks.pauseRate, oddWordRate: odd
    };
    var cmp = M.compare(sample, cfg.baseline.chat, M.CHAT_KEYS);
    if (cmp.score == null) return null;
    if (cmp.score < threshold()) {
      if (cmp.score < 40) send({ type: 'learn', sample: sample });
      return null;
    }
    return { cmp: cmp, sample: sample };
  }

  function afterSend(ed) { setTimeout(function () { try { resetDraft(ed); } catch (e) { /* ignore */ } }, 0); }

  // ---------- resending after "Send anyway" ----------
  function keyEvent(type, init) {
    return new KeyboardEvent(type, {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      ctrlKey: !!init.ctrlKey, metaKey: !!init.metaKey, shiftKey: false, altKey: false,
      bubbles: true, cancelable: true, composed: true
    });
  }
  function pressEnter(ed, init) {
    ed.dispatchEvent(keyEvent('keydown', init));
    ed.dispatchEvent(keyEvent('keypress', init));
    ed.dispatchEvent(keyEvent('keyup', init));
  }
  function stillHasText(ed) { return document.contains(ed) && textLength(ed) > 0; }

  function resend(ed, how) {
    var init = how.keyInit || { ctrlKey: site.sendKey === 'ctrlEnter' };
    var tried = [];
    function attempt(method) {
      tried.push(method);
      bypass = true;
      try {
        try { ed.focus(); } catch (e) { /* ignore */ }
        if (method === 'button') {
          var btn = findSendButton(ed);
          if (!btn) return false;
          btn.click();
        } else {
          pressEnter(ed, init);
        }
        return true;
      } finally {
        bypass = false;
      }
    }
    // Clicking the site's own send button is the most reliable; a synthetic Enter is the fallback.
    var ok = attempt('button') || attempt('key');
    setTimeout(function () {
      if (!stillHasText(ed)) { afterSend(ed); return; }
      var other = tried.indexOf('key') < 0 ? 'key' : tried.indexOf('button') < 0 ? 'button' : null;
      if (other) attempt(other);
      setTimeout(function () {
        if (stillHasText(ed)) {
          // Leave the draft marked as already-reviewed so the user's next Enter goes straight through.
          UI.toast('SecondLook couldn’t press send for you — press send again, it won’t ask twice.');
          log('Couldn’t re-send automatically on ' + site.label + '; the next send goes straight through.');
        } else {
          afterSend(ed);
        }
      }, 500);
    }, ok ? 450 : 0);
  }

  // ---------- the prompt ----------
  function planFor() {
    if (!nightOutActive() || !cfg.nightOut.planText) return null;
    return { text: cfg.nightOut.planText, note: cfg.nightOut.note || '' };
  }
  function ridesFor() {
    if (!RIDES) return [];
    var b = cfg.baseline;
    return RIDES.rideOptions({ address: b.homeAddress, home: b.home }).slice(0, 4);
  }

  function prompt(ed, decision, how) {
    var d = draft(ed);
    d.nudged = true;
    promptOpen = true;
    var score = decision.cmp.score;
    log('Paused a message on ' + site.label + ' before it was sent — it looked different from how you usually text (' + score + '/100).', 'nudge');
    send({ type: 'flag', score: score, site: site.id }, function (res) {
      var recent = (res && res.recentHour) || 1;
      var rides = ridesFor();
      UI.show({
        reasons: M.explain(decision.cmp.rows),
        seconds: (cfg.baseline.settings && cfg.baseline.settings.nudgeTimeout) || 45,
        plan: planFor(),
        rides: rides,
        onRide: function (r) {
          if (RIDES && r.copyAddress && cfg.baseline.homeAddress) {
            RIDES.copyText(cfg.baseline.homeAddress).then(function (ok) { if (ok) UI.toast('Home address copied – paste it as destination'); });
          }
          log('Opened ' + r.name + ' from the second-look prompt on ' + site.label + '.', 'ride');
        },
        onEdit: function () {
          promptOpen = false;
          log('You chose to take a second look and edit the message on ' + site.label + '.', 'nudge');
          try { ed.focus(); } catch (e) { /* ignore */ }
        },
        onSend: function () {
          promptOpen = false;
          log('You chose to send the message anyway on ' + site.label + '. Your call — SecondLook only asked.', 'nudge');
          resend(ed, how);
          if (recent >= 3) send({ type: 'escalate', reason: 'ext-repeated' });
          else if (score >= 85) send({ type: 'escalate', reason: 'ext-strong' });
        },
        onCheck: function () {
          promptOpen = false;
          log('You chose to do a quick check (opened the SecondLook web app).', 'nudge');
          send({ type: 'openApp', path: 'check' });
        },
        onTimeout: function () {
          promptOpen = false;
          log('No response to the second-look prompt on ' + site.label + '. The message was not sent.', 'nudge');
          send({ type: 'escalate', reason: 'ext-ignored' });
        }
      });
    });
  }

  // ---------- interception (capture phase, on window, so we run before the site) ----------
  window.addEventListener('keydown', function (e) {
    if (bypass || !e.isTrusted) return;
    try {
      if (!SEL.isSendKey(site, e)) return;
      var ed = editorFrom(e.target);
      if (!ed || !enabled()) return;
      if (promptOpen) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      var decision = evaluate(ed);
      if (!decision) { afterSend(ed); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      prompt(ed, decision, { via: 'key', keyInit: { ctrlKey: e.ctrlKey, metaKey: e.metaKey } });
    } catch (err) { /* fail open: the site handles Enter normally */ }
  }, true);

  window.addEventListener('click', function (e) {
    if (bypass || !e.isTrusted) return;
    try {
      var btn = isSendButton(e.target);
      if (!btn || !enabled()) return;
      var ed = lastEditor && document.contains(lastEditor) ? lastEditor : null;
      if (!ed || !textLength(ed)) return;
      if (promptOpen) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      var decision = evaluate(ed);
      if (!decision) { afterSend(ed); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      prompt(ed, decision, { via: 'click' });
    } catch (err) { /* fail open */ }
  }, true);
})();
