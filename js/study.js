/* SecondLook — validation study (study.html).
 *
 * NO ALCOHOL IS INVOLVED. We use safe, legal STAND-INS that disturb motor control and
 * attention: typing with the non-dominant hand, a dual task (counting backwards out
 * loud), and optionally being genuinely tired. A sober retest measures false alarms.
 *
 * Recorded: timing/counts only. Free-typing text is read once in memory to count
 * misspelled words, then the box is cleared. No names — participants are P01, P02…
 */
(function () {
  'use strict';

  var M = window.SLMetrics, T = window.SLTests;
  var DICT = new Set(String(window.SL_WORDS || '').split(/\s+/).filter(Boolean));
  var STORE = 'secondlook.study.v1';
  var SCHEMA = 1;

  var CONDITIONS = {
    a_sober: { label: 'Sober retest', standIn: false,
      how: 'Do everything exactly like the baseline, with your usual hand and full attention. This is the most important round: it tells us how often SecondLook would wrongly flag a sober person.' },
    b_nondominant: { label: 'Non-dominant hand (stand-in)', standIn: true,
      how: 'Use ONLY your non-dominant hand for everything — tapping, following the dot and typing.' },
    c_dualtask: { label: 'Dual task (stand-in)', standIn: true,
      how: 'While you do every task, count backwards from 300 in steps of 7, OUT LOUD (300, 293, 286…). Keep counting the whole time, even if you lose your place.' },
    d_tired: { label: 'Tired / late night (self-reported stand-in)', standIn: true,
      how: 'Only do this if it is genuinely late or you feel tired. Do the tasks normally.' }
  };
  var PROMPTS = [
    'Text a friend about what you’re doing this weekend.',
    'Ask someone to pick you up later tonight, and say where.',
    'Tell a friend how your day went.',
    'Reply to: “are you coming to the party?”',
    'Describe your favourite food to a friend.',
    'Remind someone to bring something tomorrow.',
    'Invite a friend to watch a movie with you.',
    'Tell someone you’ll be late and why.'
  ];

  var root = document.getElementById('study');
  var widget = null, rec = null;
  var st = load();

  function $(sel) { return root.querySelector(sel); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* memory only */ } }
  function clearSaved() { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } }
  function shuffle(a) {
    a = a.slice();
    var r = new Uint32Array(a.length);
    crypto.getRandomValues(r);
    for (var i = a.length - 1; i > 0; i--) { var j = r[i] % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function focusH1() { var h = root.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  function cleanup() { if (widget) { widget.destroy(); widget = null; } if (rec) { rec.destroy(); rec = null; } }
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
  }
  function device() {
    return {
      pointer: window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine',
      width: window.innerWidth, touch: 'ontouchstart' in window
    };
  }
  function unusedPrompts(n) {
    var used = st.usedPrompts || [];
    var pool = PROMPTS.filter(function (p) { return used.indexOf(p) < 0; });
    if (pool.length < n) pool = PROMPTS.slice();
    var pick = shuffle(pool).slice(0, n);
    st.usedPrompts = used.concat(pick);
    return pick;
  }

  // ---------------------------------------------------------------- screens
  function intro() {
    cleanup();
    var resume = st && st.participant && !st.done;
    root.innerHTML = '<div class="container narrow">' +
      '<p class="eyebrow">Validation study · about 12 minutes</p>' +
      '<h1>Help test SecondLook — no alcohol involved</h1>' +
      '<div class="card lock"><p><b>Please don’t drink for this study.</b> We never test with alcohol. Instead we use safe stand-ins that make typing and tapping harder in similar ways: using your other hand, and counting backwards out loud. They are <b>stand-ins, not intoxication</b>.</p></div>' +
      '<div class="card"><h2>What we record</h2><ul class="ticks">' +
        '<li>Timing and counts only: reaction times, how closely you follow a dot, keystroke timing, corrections and pauses.</li>' +
        '<li>When you type freely, the text is read once to count misspelled words, then cleared. <b>Your words are never saved.</b></li>' +
        '<li>No name. You get an anonymous code like P01. Device info: touch or mouse, and screen width.</li>' +
        '<li>At the end you download one file and give it to the organiser. Nothing is uploaded.</li>' +
      '</ul></div>' +
      (resume ? '<div class="card"><p>A session for <b>' + esc(st.participant) + '</b> is in progress.</p><div class="row-btns"><button class="btn primary" id="resume">Resume</button><button class="btn ghost" id="restart">Start over</button></div></div>' : '') +
      '<form class="card form" id="start" novalidate>' +
        '<label class="field"><span>Participant code (from the organiser)</span><input name="code" maxlength="4" placeholder="P01" pattern="P[0-9]{2,3}" required></label>' +
        '<label class="check"><input type="checkbox" name="sober"><span>I haven’t had alcohol or other substances today, and won’t during the study.</span></label>' +
        '<label class="check"><input type="checkbox" name="ok"><span>I understand only timing is recorded, and I can stop at any time.</span></label>' +
        '<label class="check"><input type="checkbox" name="tired"><span>Optional: it’s genuinely late or I’m tired right now — include the “tired” round too.</span></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn primary big full" type="submit">Start with the baseline</button>' +
      '</form>' +
      '<div class="card"><h2>Coming back for the tired round?</h2><p class="muted">Load your earlier file to add a “tired / late night” round to it.</p>' +
        '<label class="btn secondary file-btn">Load my file<input type="file" id="cont" accept=".json,application/json"></label><p class="form-error" id="cont-err" role="alert"></p></div>' +
      '</div>';
    if (resume) {
      $('#resume').addEventListener('click', next);
      $('#restart').addEventListener('click', function () { if (confirm('Discard the session in progress?')) { st = null; clearSaved(); intro(); } });
    }
    $('#start').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, code = String(f.code.value || '').trim().toUpperCase();
      var err = f.querySelector('.form-error');
      if (!/^P\d{2,3}$/.test(code)) { err.textContent = 'Use the code from the organiser, like P01.'; return; }
      if (!f.sober.checked || !f.ok.checked) { err.textContent = 'Please confirm both statements to take part.'; return; }
      var plan = shuffle(['a_sober', 'b_nondominant', 'c_dualtask']);
      if (f.tired.checked) plan.push('d_tired');
      st = { kind: 'secondlook-study', schema: SCHEMA, participant: code, synthetic: false, createdAt: Date.now(),
        device: device(), consent: { noAlcohol: true, timingOnly: true, at: Date.now() },
        baseline: null, plan: plan, idx: 0, conditions: [], usedPrompts: [], done: false };
      save();
      next();
    });
    $('#cont').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      file.text().then(function (txt) {
        var d = JSON.parse(txt);
        if (d.kind !== 'secondlook-study' || !d.baseline || !d.baseline.test || !/^P\d{2,3}$/.test(d.participant)) throw new Error('bad');
        if (d.synthetic) throw new Error('synthetic');
        if (d.conditions.some(function (c) { return c.id === 'd_tired'; })) throw new Error('done');
        d.plan = ['d_tired']; d.idx = 0; d.done = false; d.continuedAt = Date.now();
        st = d; save(); next();
      }).catch(function (e) {
        $('#cont-err').textContent = e.message === 'done' ? 'This file already has a tired round.' : 'That isn’t a SecondLook study file.';
      });
    });
    focusH1();
  }

  function next() {
    cleanup();
    if (!st.baseline) { baselineIntro(); return; }
    if (st.idx < st.plan.length) { conditionIntro(st.plan[st.idx]); return; }
    finish();
  }

  // ---------------------------------------------------------------- tasks
  function runSteps(title, steps, done) {
    var results = {};
    function run(i) {
      cleanup();
      if (i >= steps.length) { done(results); return; }
      var s = steps[i];
      root.innerHTML = '<div class="container narrow"><p class="eyebrow">' + esc(title) + ' · step ' + (i + 1) + ' of ' + steps.length + '</p>' +
        '<h1>' + esc(s.title) + '</h1><p class="lead">' + esc(s.desc) + '</p>' +
        (s.reminder ? '<p class="ci-note">' + esc(s.reminder) + '</p>' : '') + '<div class="task-host"></div></div>';
      var host = root.querySelector('.task-host');
      var finish = function (r) { results[s.key] = r; setTimeout(function () { run(i + 1); }, 250); };
      if (s.key === 'reaction') widget = T.reactionTest(host, { trials: 5, onDone: finish });
      else if (s.key === 'tracking') widget = T.trackingTest(host, { duration: s.duration, onDone: finish });
      else if (s.key === 'typing') widget = T.typingTest(host, { sentences: s.sentences, onDone: finish });
      else widget = freeTyping(host, s.prompts, finish);
      if (s.key !== 'typing' && s.key !== 'free') focusH1();
    }
    run(0);
  }

  /** Free typing: returns [{chat features}] — the text itself is discarded. */
  function freeTyping(host, prompts, done) {
    var out = [], i = 0;
    function show() {
      host.innerHTML = '<p class="tt-step">Message ' + (i + 1) + ' of ' + prompts.length + '</p>' +
        '<p class="tt-target">' + esc(prompts[i]) + '</p>' +
        '<label class="sr-only" for="free">Your message</label>' +
        '<textarea id="free" class="tt-input" rows="3" autocomplete="off" spellcheck="false" placeholder="Type it like a real text…"></textarea>' +
        '<div class="tt-row"><span class="tt-hint" aria-live="polite">A sentence or two is plenty. Your words are not saved.</span><button type="button" class="btn primary" id="free-next" disabled>Next</button></div>';
      var ta = host.querySelector('#free'), btn = host.querySelector('#free-next');
      if (rec) rec.destroy();
      rec = new T.KeystrokeRecorder(ta);
      ta.addEventListener('paste', function (e) { e.preventDefault(); });
      function ready() { return ta.value.trim().length >= 20 && M.words(ta.value).length >= 4; }
      ta.addEventListener('input', function () { btn.disabled = !ready(); });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (ready()) go(); } });
      btn.addEventListener('click', go);
      function go() {
        var ks = M.analyzeKeystrokes(rec.events);
        out.push({ ikiMs: ks.ikiMs, ikiCv: ks.ikiCv, backspaceRate: ks.backspaceRate, pauseRate: ks.pauseRate, oddWordRate: M.oddWordRate(ta.value, DICT, null) });
        ta.value = ''; // text discarded
        i++;
        if (i < prompts.length) show(); else { rec.destroy(); rec = null; done(out); }
      }
      setTimeout(function () { if (document.contains(ta)) ta.focus(); }, 60);
    }
    show();
    return { destroy: function () { if (rec) { rec.destroy(); rec = null; } } };
  }

  function baselineIntro() {
    root.innerHTML = '<div class="container narrow"><p class="eyebrow">' + esc(st.participant) + ' · part 1</p>' +
      '<h1>Baseline — just be yourself</h1>' +
      '<p class="lead">Five short tasks with your usual hand and full attention. About 3 minutes.</p>' +
      '<button class="btn primary big full" id="go">Start the baseline</button></div>';
    $('#go').addEventListener('click', function () {
      runSteps('Baseline', [
        { key: 'reaction', title: 'Reaction time', desc: 'Tap the moment it turns green. 5 rounds.' },
        { key: 'tracking', title: 'Steady hand', desc: 'Press on the glowing dot and follow it for 12 seconds.', duration: 12000 },
        { key: 'typing', title: 'Typing', desc: 'Type each sentence the way you normally would.', sentences: T.pickSentences(2) },
        { key: 'free', title: 'Write two short texts', desc: 'Type them like real messages to a friend.', prompts: unusedPrompts(2) }
      ], function (res) {
        st.baseline = {
          test: M.baselineFromTasks(res),
          chat: (function () {
            var c = {};
            M.CHAT_KEYS.forEach(function (k) { c[k] = M.fromSamples(res.free.map(function (s) { return s[k]; })); });
            return c;
          })(),
          at: Date.now()
        };
        save();
        next();
      });
    });
    focusH1();
  }

  function conditionIntro(id) {
    var c = CONDITIONS[id];
    var n = st.idx + 1, total = st.plan.length;
    root.innerHTML = '<div class="container narrow"><p class="eyebrow">' + esc(st.participant) + ' · round ' + n + ' of ' + total + '</p>' +
      '<h1>' + esc(c.label) + '</h1>' +
      '<div class="card"><p>' + esc(c.how) + '</p>' +
      (c.standIn ? '<p class="small muted">This is a safe stand-in for impairment. It is not the same as being drunk.</p>' : '') + '</div>' +
      (id === 'd_tired' ? '<form class="card form" id="self"><label class="field"><span>How tired are you right now?</span><select name="tired">' +
        '<option value="">Choose…</option><option value="1">1 — wide awake</option><option value="2">2</option><option value="3">3 — a bit tired</option><option value="4">4</option><option value="5">5 — exhausted</option></select></label>' +
        '<p class="form-error" role="alert"></p></form>' : '') +
      '<button class="btn primary big full" id="go">Start this round (about 2 minutes)</button></div>';
    $('#go').addEventListener('click', function () {
      var self = null;
      if (id === 'd_tired') {
        var v = Number($('#self').tired.value);
        if (!v) { $('#self .form-error').textContent = 'Please rate how tired you are.'; return; }
        self = { tiredness: v, hour: new Date().getHours() };
      }
      var reminder = id === 'b_nondominant' ? 'Non-dominant hand only.' : id === 'c_dualtask' ? 'Keep counting backwards by 7, out loud.' : '';
      runSteps(c.label, [
        { key: 'reaction', title: 'Reaction time', desc: 'Tap the moment it turns green. 5 rounds.', reminder: reminder },
        { key: 'tracking', title: 'Steady hand', desc: 'Follow the dot for 10 seconds.', duration: 10000, reminder: reminder },
        { key: 'typing', title: 'Typing', desc: 'Type the sentence.', sentences: T.pickSentences(1), reminder: reminder },
        { key: 'free', title: 'Write a short text', desc: 'Type it like a real message.', prompts: unusedPrompts(1), reminder: reminder }
      ], function (res) {
        var testSample = M.sampleFromTasks(res);
        var chatSample = res.free[0];
        var testCmp = M.compare(testSample, st.baseline.test, M.TEST_KEYS);
        var chatCmp = M.compare(chatSample, st.baseline.chat, M.CHAT_KEYS);
        st.conditions.push({
          id: id, label: c.label, standIn: c.standIn, order: st.conditions.length + 1, at: Date.now(), selfReport: self,
          test: pack(testSample, testCmp, M.TEST_KEYS),
          chat: pack(chatSample, chatCmp, M.CHAT_KEYS)
        });
        st.idx++;
        save();
        next();
      });
    });
    focusH1();
  }

  function pack(sample, cmp, keys) {
    var values = {}, z = {};
    keys.forEach(function (k) { values[k] = typeof sample[k] === 'number' && isFinite(sample[k]) ? sample[k] : null; z[k] = null; });
    cmp.rows.forEach(function (r) { z[r.key] = Math.round(r.z * 1000) / 1000; });
    return { values: values, z: z, score: cmp.score };
  }

  function exportObj() {
    return {
      kind: 'secondlook-study', schema: SCHEMA, participant: st.participant, synthetic: false,
      createdAt: st.createdAt, exportedAt: Date.now(), device: st.device, consent: st.consent,
      baseline: st.baseline, conditions: st.conditions
    };
  }
  function download() {
    var blob = new Blob([JSON.stringify(exportObj(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'secondlook-study-' + st.participant + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function finish() {
    st.done = true;
    save();
    root.innerHTML = '<div class="container narrow"><div class="done-mark" aria-hidden="true">✓</div>' +
      '<h1>Thank you, ' + esc(st.participant) + '!</h1>' +
      '<p class="lead">Download your file and send it to the organiser. It contains numbers only — no words, no name.</p>' +
      '<div class="card"><h2>Your rounds</h2><ul class="bars">' + st.conditions.map(function (c) {
        return '<li><div class="bar-top"><span>' + esc(c.label) + '</span><span class="muted">quick check ' + (c.test.score == null ? '—' : c.test.score) + ' · message ' + (c.chat.score == null ? '—' : c.chat.score) + '</span></div></li>';
      }).join('') + '</ul><p class="small muted">Scores are 0–100: how different each round looked from your baseline.</p></div>' +
      '<button class="btn primary big full" id="dl">Download my file</button>' +
      '<button class="btn ghost full" id="new">Next participant (clears this session)</button></div>';
    $('#dl').addEventListener('click', download);
    $('#new').addEventListener('click', function () {
      if (!confirm('Did you download the file? This clears the session from this browser.')) return;
      st = null; clearSaved(); intro();
    });
    focusH1();
  }

  st = st && st.kind === 'secondlook-study' ? st : null;
  intro();
})();
