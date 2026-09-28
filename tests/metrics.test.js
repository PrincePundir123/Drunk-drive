// Unit tests for the scoring logic: `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/metrics.js');
const WORDS = require('../js/words.js');

const DICT = new Set(WORDS.split(/\s+/).filter(Boolean));

function typing(gapMs, chars, { deletesEvery = 0, pauseEvery = 0 } = {}) {
  const ev = [];
  let t = 0;
  for (let i = 0; i < chars; i++) {
    t += gapMs;
    if (pauseEvery && i > 0 && i % pauseEvery === 0) t += 2500;
    ev.push({ t, kind: 'insert', n: 1 });
    if (deletesEvery && i % deletesEvery === 0) { t += gapMs; ev.push({ t, kind: 'delete', n: 1 }); t += gapMs; ev.push({ t, kind: 'insert', n: 1 }); }
  }
  return ev;
}

test('basic stats', () => {
  assert.equal(M.mean([1, 2, 3]), 2);
  assert.equal(M.median([5, 1, 3]), 3);
  assert.equal(M.median([4, 1, 3, 2]), 2.5);
  assert.ok(Math.abs(M.sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01);
  assert.ok(Number.isNaN(M.mean([])));
});

test('Welford running stats match batch stats', () => {
  const xs = [310, 290, 335, 300, 280];
  const st = M.fromSamples(xs);
  assert.equal(st.n, 5);
  assert.ok(Math.abs(st.mean - M.mean(xs)) < 1e-9);
  assert.ok(Math.abs(M.statSd(st) - M.sd(xs)) < 1e-9);
  // non-numbers are ignored
  assert.equal(M.fromSamples([1, null, NaN, undefined, 3]).n, 2);
  const s = M.seeded(100, 10, 5);
  assert.ok(Math.abs(M.statSd(s) - 10) < 1e-9);
});

test('levenshtein and typo rate', () => {
  assert.equal(M.levenshtein('kitten', 'sitting'), 3);
  assert.equal(M.levenshtein('', 'abc'), 3);
  assert.equal(M.typoRate('hello world', 'Hello   world'), 0);
  assert.ok(M.typoRate('helo wrld', 'hello world') > 0.1);
  assert.equal(M.typoRate('', 'abc'), null);
  // stopping early is not counted as a typo
  assert.equal(M.typoRate('The quick', 'The quick brown fox'), 0);
});

test('dictionary check handles slang, contractions, stretching and stems', () => {
  for (const w of ["don't", "i'm", 'heyyy', 'sooo', 'friends', 'going', 'parties', 'lol', 'yaar', 'drinking']) {
    assert.ok(M.isKnown(w, DICT, new Set()), w + ' should be known');
  }
  for (const w of ['fnie', 'cna', 'hme', 'drvie']) assert.ok(!M.isKnown(w, DICT, new Set()), w + ' should be odd');
  assert.ok(M.isKnown('zorblat', DICT, new Set(['zorblat'])), 'personal vocabulary is respected');
  assert.equal(M.oddWordRate('hi', DICT, new Set()), null, 'too short to judge');
  assert.equal(M.oddWordRate('are you coming home tonight', DICT, new Set()), 0);
  assert.ok(M.oddWordRate('heyy im fnie tbh cna drive hme now lol', DICT, new Set()) > 0.3);
});

test('keystroke analysis', () => {
  const k = M.analyzeKeystrokes(typing(150, 40));
  assert.equal(k.chars, 40);
  assert.equal(k.ikiMs, 150);
  assert.equal(k.backspaceRate, 0);
  assert.equal(k.pauseRate, 0);
  const sloppy = M.analyzeKeystrokes(typing(400, 40, { deletesEvery: 4, pauseEvery: 8 }));
  assert.ok(sloppy.backspaceRate > 0.15);
  assert.ok(sloppy.pauseRate > 1);
  assert.equal(M.analyzeKeystrokes([]).ikiMs, null);
  // gaps longer than 20 s (walked away) are ignored completely
  const idle = M.analyzeKeystrokes([{ t: 0, kind: 'insert' }, { t: 60000, kind: 'insert' }]);
  assert.equal(idle.pauseRate, 0);
});

test('compare: normal typing scores low, impaired typing scores high', () => {
  const s = M.seeded;
  const chat = { ikiMs: s(210, 45, 12), ikiCv: s(0.65, 0.15, 12), backspaceRate: s(0.09, 0.06, 12), pauseRate: s(0.5, 0.5, 12), oddWordRate: s(0.06, 0.06, 12) };
  const normal = M.compare({ ikiMs: 220, ikiCv: 0.62, backspaceRate: 0.1, pauseRate: 0.4, oddWordRate: 0 }, chat, M.CHAT_KEYS);
  assert.ok(normal.score < 30, 'normal score ' + normal.score);
  assert.equal(normal.level, 'ok');
  const faster = M.compare({ ikiMs: 100, ikiCv: 0.3, backspaceRate: 0, pauseRate: 0, oddWordRate: 0 }, chat, M.CHAT_KEYS);
  assert.equal(faster.score, 0, 'being faster/cleaner than usual is never a warning');
  const drunk = M.compare({ ikiMs: 480, ikiCv: 1.1, backspaceRate: 0.35, pauseRate: 2.5, oddWordRate: 0.38 }, chat, M.CHAT_KEYS);
  assert.ok(drunk.score >= 80, 'impaired score ' + drunk.score);
  assert.equal(drunk.level, 'high');
  assert.ok(M.explain(drunk.rows).length > 0);
  assert.equal(M.compare({}, chat, M.CHAT_KEYS).score, null);
});

test('compare: floors stop tiny baselines from causing false alarms', () => {
  // A baseline built from a single sample has sd = 0; the floor must keep z sane.
  const base = { reactionMs: M.fromSamples([300]) };
  const r = M.compare({ reactionMs: 310 }, base, ['reactionMs']);
  assert.ok(r.rows[0].z < 0.5, 'z was ' + r.rows[0].z);
  assert.equal(r.level, 'ok');
});

test('the simulated impaired message in the demo is caught', () => {
  // Mirrors the demo's synthetic impaired keystrokes with a fixed pattern.
  const s = M.seeded;
  const chat = { ikiMs: s(210, 45, 12), ikiCv: s(0.65, 0.15, 12), backspaceRate: s(0.09, 0.06, 12), pauseRate: s(0.5, 0.5, 12), oddWordRate: s(0.06, 0.06, 12) };
  const text = 'heyy im fnie tbh cna drive hme now lol';
  const ks = M.analyzeKeystrokes(typing(480, text.length, { deletesEvery: 5, pauseEvery: 11 }));
  const sample = Object.assign({}, ks, { oddWordRate: M.oddWordRate(text, DICT, new Set()) });
  const r = M.compare(sample, chat, M.CHAT_KEYS);
  assert.ok(r.score >= 55, 'score ' + r.score);
});

test('averageSamples ignores missing values', () => {
  const avg = M.averageSamples([{ a: 1, b: null }, { a: 3, b: 4 }], ['a', 'b', 'c']);
  assert.deepEqual(avg, { a: 2, b: 4, c: null });
});

test('baselineFromTasks / sampleFromTasks build the same shapes the app used before', () => {
  const res = {
    reaction: { trials: [300, 320, 280], reactionMs: 300 },
    tracking: { trackingErr: 5 },
    typing: [{ ikiMs: 150, ikiCv: 0.5, backspaceRate: 0.1, pauseRate: 0, typoRate: 0.02 }, { ikiMs: 170, ikiCv: 0.7, backspaceRate: null, pauseRate: 0.5, typoRate: 0 }]
  };
  const t = M.baselineFromTasks(res);
  assert.equal(t.reactionMs.n, 3);
  assert.equal(t.reactionMs.mean, 300);
  assert.equal(t.trackingErr.n, 1);
  assert.equal(t.ikiMs.mean, 160);
  assert.equal(t.backspaceRate.n, 1, 'missing values are skipped');
  const s = M.sampleFromTasks(res);
  assert.equal(s.reactionMs, 300);
  assert.equal(s.ikiMs, 160);
  assert.equal(M.compare(s, t, M.TEST_KEYS).level, 'ok');
  assert.equal(M.baselineFromTasks({ reaction: { trials: [] }, tracking: { trackingErr: null }, typing: [] }).trackingErr.n, 0, 'skipped tracking');
});
