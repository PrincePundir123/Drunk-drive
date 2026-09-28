// Tests for the study analysis math.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scripts/lib/analysis.js');
const M = require('../js/metrics.js');

function participant(code, scores) {
  return {
    kind: 'secondlook-study', schema: 1, participant: code, synthetic: false,
    conditions: Object.keys(scores).map((id, i) => ({
      id, order: i + 1,
      test: { score: scores[id][0], z: { reactionMs: scores[id][0] / 25 }, values: {} },
      chat: { score: scores[id][1], z: { ikiMs: scores[id][1] / 25 }, values: {} }
    }))
  };
}
const people = [
  participant('P01', { a_sober: [10, 20], b_nondominant: [45, 50], c_dualtask: [70, 30] }),
  participant('P02', { a_sober: [42, 5], b_nondominant: [30, 60], c_dualtask: [80, 66] }),
  participant('P03', { a_sober: [0, 0], b_nondominant: [66, 41], c_dualtask: [40, 20] }),
  participant('P04', { a_sober: [66, 12], b_nondominant: [20, 10], c_dualtask: [55, 90] })
];

test('rates at or above a threshold', () => {
  assert.equal(A.rateAtOrAbove([10, 40, 65, 90], 40), 0.75);
  assert.equal(A.rateAtOrAbove([10, 39.9], 40), 0);
  assert.equal(A.rateAtOrAbove([], 40), null, 'no data is not 0%');
});

test('false-alarm and detection rates', () => {
  const c = A.collect(people);
  assert.deepEqual(c.a_sober.test.scores, [10, 42, 0, 66]);
  assert.equal(A.falseAlarmRate(c, 40, 'test'), 0.5);
  assert.equal(A.falseAlarmRate(c, 65, 'test'), 0.25);
  assert.equal(A.falseAlarmRate(c, 40, 'chat'), 0);
  assert.equal(A.detectionRate(c, 'c_dualtask', 40, 'test'), 1);
  assert.equal(A.detectionRate(c, 'c_dualtask', 65, 'chat'), 0.5);
  assert.equal(A.detectionRate(c, 'd_tired', 40, 'test'), null);
  assert.equal(c.b_nondominant.participants.size, 4);
});

test('threshold sweep is monotonic and covers 30–80 in steps of 5', () => {
  const rows = A.sweep(A.collect(people), 'test', 30, 80, 5);
  assert.deepEqual(rows.map(r => r.threshold), [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].falseAlarm <= rows[i - 1].falseAlarm, 'false alarms never rise with the threshold');
    assert.ok(rows[i].detect.c_dualtask <= rows[i - 1].detect.c_dualtask);
  }
  assert.equal(rows[rows.length - 1].falseAlarm, 0);
});

test('AUC and Wilson interval', () => {
  assert.equal(A.auc([3, 4], [1, 2]), 1);
  assert.equal(A.auc([1, 2], [3, 4]), 0);
  assert.equal(A.auc([1], [1]), 0.5);
  assert.equal(A.auc([], [1]), null);
  const [lo, hi] = A.wilson(0, 10);
  assert.equal(lo, 0);
  assert.ok(hi > 0.25 && hi < 0.32, 'zero of ten still has a wide upper bound: ' + hi);
  const w = A.wilson(5, 10);
  assert.ok(w[0] < 0.5 && w[1] > 0.5);
  assert.equal(A.wilson(0, 0), null);
});

test('signal separation ranks signals by mean AUC', () => {
  const rows = A.signalSeparation(A.collect(people), 'test');
  assert.equal(rows[0].signal, 'reactionMs');
  assert.ok(rows[0].mean > 0.5);
});

test('validation rejects bad files', () => {
  assert.deepEqual(A.validateParticipant(people[0]), []);
  assert.ok(A.validateParticipant({}).length);
  assert.ok(A.validateParticipant({ kind: 'secondlook-study', participant: 'Bob', conditions: [] }).length);
});

test('synthetic data is watermarked everywhere and scored with the real math', () => {
  const fake = A.syntheticParticipants(M, 4, 1);
  assert.ok(fake.every(p => p.synthetic === true && p.watermark === A.WATERMARK));
  assert.ok(fake.every(p => A.validateParticipant(p).length === 0));
  const md = A.summaryMarkdown(fake, { synthetic: true, now: 'x' });
  assert.ok(md.startsWith('> ⚠️ **' + A.WATERMARK));
  assert.ok(md.trim().endsWith('**' + A.WATERMARK + '.**'));
  const svg = A.chartSvg(fake, { synthetic: true });
  assert.ok(svg.startsWith('<svg') && svg.includes(A.WATERMARK));
  assert.ok(!A.summaryMarkdown(fake, {}).includes(A.WATERMARK), 'real reports carry no watermark');
  // deterministic for a given seed
  assert.deepEqual(A.syntheticParticipants(M, 2, 5), A.syntheticParticipants(M, 2, 5));
});
