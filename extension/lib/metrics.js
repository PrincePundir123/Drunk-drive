/* SecondLook — metrics.
 * Pure functions, no DOM. Runs in the browser and in Node (for unit tests).
 *
 * The idea: we never judge you against "average people". Every signal is
 * compared with YOUR OWN sober baseline, using a z-score with sensible floors
 * so tiny baselines don't produce huge false alarms. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLMetrics = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- basic stats ----------
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : NaN; }
  function median(a) {
    if (!a.length) return NaN;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1));
  }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  // ---------- running stats (Welford) so the baseline can keep learning ----------
  function stat() { return { n: 0, mean: 0, m2: 0 }; }
  function push(st, x) {
    st = st || stat();
    if (typeof x !== 'number' || !isFinite(x)) return st;
    var n = st.n + 1;
    var d = x - st.mean;
    var m = st.mean + d / n;
    return { n: n, mean: m, m2: st.m2 + d * (x - m) };
  }
  function statSd(st) { return st && st.n > 1 ? Math.sqrt(Math.max(0, st.m2) / (st.n - 1)) : 0; }
  function fromSamples(arr) { return (arr || []).reduce(push, stat()); }
  function seeded(m, s, n) { n = Math.max(1, n || 1); return { n: n, mean: m, m2: s * s * (n - 1) }; }

  // ---------- text helpers ----------
  function levenshtein(a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1), cur = new Array(b.length + 1), i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  function normText(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  /** Share of characters that differ from the sentence the user was asked to type. */
  function typoRate(typed, target) {
    var a = normText(typed), b = normText(target);
    if (!b.length || !a.length) return null;
    var ref = a.length < b.length ? b.slice(0, a.length) : b;
    return levenshtein(a, ref) / Math.max(ref.length, 1);
  }

  function words(text) {
    return (String(text || '').toLowerCase().match(/[a-z']+/g) || [])
      .map(function (w) { return w.replace(/^'+|'+$/g, ''); })
      .filter(function (w) { return w.length >= 2; });
  }

  function collapse(w, max) {
    // "heyyyy" -> "heyy" (max 2) or "hey" (max 1)
    return w.replace(/(.)\1+/g, function (run, ch) { return ch.repeat(Math.min(run.length, max)); });
  }

  function isKnown(w, dict, vocab) {
    var has = function (x) { return x.length > 0 && (dict.has(x) || (vocab && vocab.has(x))); };
    var base = w.replace(/'/g, '');
    var cands = [w, base, collapse(base, 2), collapse(base, 1)];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (has(c)) return true;
      // light stemming: friends, parties, going, moved, really
      if (c.length > 3 && /s$/.test(c) && has(c.slice(0, -1))) return true;
      if (c.length > 4 && /es$/.test(c) && has(c.slice(0, -2))) return true;
      if (c.length > 4 && /ies$/.test(c) && has(c.slice(0, -3) + 'y')) return true;
      if (c.length > 4 && /ing$/.test(c) && (has(c.slice(0, -3)) || has(c.slice(0, -3) + 'e'))) return true;
      if (c.length > 3 && /ed$/.test(c) && (has(c.slice(0, -2)) || has(c.slice(0, -1)))) return true;
      if (c.length > 4 && /ly$/.test(c) && has(c.slice(0, -2))) return true;
    }
    return false;
  }

  /** Share of words that are neither in the dictionary nor in the user's own sober vocabulary. */
  function oddWordRate(text, dict, vocab) {
    var ws = words(text);
    if (ws.length < 3) return null;
    var odd = ws.filter(function (w) { return !isKnown(w, dict, vocab); }).length;
    return odd / ws.length;
  }

  // ---------- keystroke dynamics ----------
  var PAUSE_MS = 1500;   // gaps longer than this are "long pauses", not rhythm
  var IDLE_MS = 20000;   // gaps longer than this mean you walked away; ignore them

  /** events: [{ t: ms timestamp, kind: 'insert' | 'delete', n: chars }] */
  function analyzeKeystrokes(events) {
    events = events || [];
    var inserted = 0, deleted = 0, gaps = [], pauses = 0, i;
    for (i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.kind === 'delete') deleted += e.n || 1; else inserted += e.n || 1;
      if (i > 0) {
        var g = e.t - events[i - 1].t;
        if (g > 0 && g <= PAUSE_MS) gaps.push(g);
        else if (g > PAUSE_MS && g <= IDLE_MS) pauses++;
      }
    }
    var enough = gaps.length >= 4;
    var gm = mean(gaps);
    return {
      chars: inserted,
      keystrokes: events.length,
      ikiMs: enough ? median(gaps) : null,
      ikiCv: enough && gm > 0 ? sd(gaps) / gm : null,
      backspaceRate: inserted > 0 ? deleted / inserted : null,
      pauseRate: inserted > 0 ? (pauses / inserted) * 20 : null
    };
  }

  // ---------- features and scoring ----------
  var FEATURES = {
    reactionMs:    { label: 'Reaction time',      more: 'Slower reactions',          rel: 0.10, abs: 25,   weight: 1.2, fmt: function (v) { return Math.round(v) + ' ms'; } },
    trackingErr:   { label: 'Tracking error',     more: 'A less steady hand',        rel: 0.15, abs: 0.8,  weight: 1.0, fmt: function (v) { return v.toFixed(1) + '%'; } },
    ikiMs:         { label: 'Time between keys',  more: 'Slower typing rhythm',      rel: 0.15, abs: 30,   weight: 1.0, fmt: function (v) { return Math.round(v) + ' ms'; } },
    ikiCv:         { label: 'Rhythm variability', more: 'A more uneven typing rhythm', rel: 0.15, abs: 0.08, weight: 0.6, fmt: function (v) { return v.toFixed(2); } },
    backspaceRate: { label: 'Corrections',        more: 'More corrections',          rel: 0.25, abs: 0.06, weight: 1.0, fmt: function (v) { return Math.round(v * 100) + '%'; } },
    pauseRate:     { label: 'Long pauses',        more: 'More long pauses',          rel: 0.25, abs: 0.5,  weight: 0.7, fmt: function (v) { return v.toFixed(1) + ' per 20 chars'; } },
    typoRate:      { label: 'Typos',              more: 'More typos',                rel: 0.25, abs: 0.03, weight: 1.2, fmt: function (v) { return Math.round(v * 100) + '%'; } },
    oddWordRate:   { label: 'Misspelled words',   more: 'More misspelled words',     rel: 0.25, abs: 0.06, weight: 1.2, fmt: function (v) { return Math.round(v * 100) + '%'; } }
  };
  var TEST_KEYS = ['reactionMs', 'trackingErr', 'ikiMs', 'ikiCv', 'backspaceRate', 'pauseRate', 'typoRate'];
  var TYPING_KEYS = ['ikiMs', 'ikiCv', 'backspaceRate', 'pauseRate', 'typoRate'];
  var CHAT_KEYS = ['ikiMs', 'ikiCv', 'backspaceRate', 'pauseRate', 'oddWordRate'];

  function levelFor(score) {
    if (score == null) return 'unknown';
    return score >= 65 ? 'high' : score >= 40 ? 'caution' : 'ok';
  }

  /**
   * Compare a sample with a baseline. Only drifts in the "impaired" direction
   * count (typing faster than usual is not a warning sign).
   * Returns { score 0-100, level, rows[] } — rows sorted most-deviant first.
   */
  function compare(sample, base, keys) {
    var rows = [];
    (keys || Object.keys(FEATURES)).forEach(function (key) {
      var def = FEATURES[key];
      var x = sample ? sample[key] : null;
      var st = base ? base[key] : null;
      if (!def || typeof x !== 'number' || !isFinite(x) || !st || !(st.n >= 1)) return;
      var m = st.mean;
      var eff = Math.max(statSd(st), Math.abs(m) * def.rel, def.abs);
      var z = clamp((x - m) / eff, -4, 4);
      rows.push({ key: key, label: def.label, value: x, baseline: m, z: z, weight: def.weight });
    });
    if (!rows.length) return { score: null, level: 'unknown', rows: rows };
    var wsum = rows.reduce(function (s, r) { return s + r.weight; }, 0);
    var avg = rows.reduce(function (s, r) { return s + r.weight * Math.max(0, r.z); }, 0) / wsum;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(0, r.z); }));
    var c = 0.6 * avg + 0.4 * max;
    var score = Math.round(100 * (1 - Math.exp(-c / 2)));
    rows.sort(function (a, b) { return b.z * b.weight - a.z * a.weight; });
    return { score: score, level: levelFor(score), rows: rows };
  }

  function describe(row) {
    var def = FEATURES[row.key];
    if (!def) return row.label;
    if (!(row.baseline > 1e-6)) return def.more + ' than usual';
    var r = row.value / row.baseline;
    if (r >= 1.8) return def.more + ' (' + r.toFixed(1) + '× your usual)';
    return def.more + ' (' + Math.max(1, Math.round((r - 1) * 100)) + '% above your usual)';
  }

  /** Human-readable reasons, strongest first. */
  function explain(rows, limit) {
    return (rows || []).filter(function (r) { return r.z >= 1; }).slice(0, limit || 3).map(describe);
  }

  function averageSamples(samples, keys) {
    var out = {};
    keys.forEach(function (k) {
      var vals = samples.map(function (s) { return s[k]; }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
      out[k] = vals.length ? mean(vals) : null;
    });
    return out;
  }

  /** Baseline statistics from one calibration run: { reaction:{trials}, tracking:{trackingErr}, typing:[samples] }. */
  function baselineFromTasks(res) {
    var t = {};
    t.reactionMs = fromSamples(res && res.reaction ? res.reaction.trials : []);
    t.trackingErr = fromSamples(res && res.tracking ? [res.tracking.trackingErr] : []);
    TYPING_KEYS.forEach(function (k) {
      t[k] = fromSamples(((res && res.typing) || []).map(function (s) { return s[k]; }));
    });
    return t;
  }

  /** One comparable sample from a quick-check run (same shape as the baseline). */
  function sampleFromTasks(res) {
    return Object.assign(
      { reactionMs: res && res.reaction ? res.reaction.reactionMs : null, trackingErr: res && res.tracking ? res.tracking.trackingErr : null },
      averageSamples((res && res.typing) || [], TYPING_KEYS)
    );
  }

  return {
    baselineFromTasks: baselineFromTasks, sampleFromTasks: sampleFromTasks,
    mean: mean, median: median, sd: sd, clamp: clamp,
    stat: stat, push: push, statSd: statSd, fromSamples: fromSamples, seeded: seeded,
    levenshtein: levenshtein, normText: normText, typoRate: typoRate,
    words: words, isKnown: isKnown, oddWordRate: oddWordRate,
    analyzeKeystrokes: analyzeKeystrokes,
    FEATURES: FEATURES, TEST_KEYS: TEST_KEYS, TYPING_KEYS: TYPING_KEYS, CHAT_KEYS: CHAT_KEYS,
    levelFor: levelFor, compare: compare, describe: describe, explain: explain,
    averageSamples: averageSamples
  };
});
