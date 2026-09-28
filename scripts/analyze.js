// Analyse SecondLook study results.
//   npm run analyze                 → reads results/*.json, writes results/summary.md + results/chart.svg
//   npm run analyze -- --synthetic  → writes FAKE data to results/synthetic/ (pipeline test only; watermarked)
'use strict';
const fs = require('fs');
const path = require('path');
const A = require('./lib/analysis.js');
const M = require('../js/metrics.js');

const ROOT = path.resolve(__dirname, '..');
const synthetic = process.argv.includes('--synthetic');
const dir = path.join(ROOT, 'results', synthetic ? 'synthetic' : '');

fs.mkdirSync(dir, { recursive: true });

if (synthetic) {
  const fake = A.syntheticParticipants(M, 10, 7);
  fake.forEach(p => fs.writeFileSync(path.join(dir, p.participant + '.json'), JSON.stringify(p, null, 2)));
  console.log('Wrote ' + fake.length + ' SYNTHETIC participant files to results/synthetic/ (fake data, pipeline test only).');
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const participants = [];
for (const f of files) {
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.warn('Skipping ' + f + ': not valid JSON'); continue; }
  const errs = A.validateParticipant(p);
  if (errs.length) { console.warn('Skipping ' + f + ': ' + errs.join('; ')); continue; }
  if (!!p.synthetic !== synthetic) {
    console.warn('Skipping ' + f + ': ' + (p.synthetic ? 'synthetic data does not belong in results/' : 'real data does not belong in results/synthetic/'));
    continue;
  }
  if (participants.some(q => q.participant === p.participant)) { console.warn('Skipping ' + f + ': duplicate participant ' + p.participant); continue; }
  participants.push(p);
}

if (!participants.length) {
  console.log('No participant files found in ' + path.relative(ROOT, dir) + '/.');
  console.log('Run the study (study.html), then put each exported secondlook-study-P##.json file in results/ and run `npm run analyze` again.');
  process.exit(0);
}

const now = new Date().toISOString();
fs.writeFileSync(path.join(dir, 'summary.md'), A.summaryMarkdown(participants, { synthetic, now }));
fs.writeFileSync(path.join(dir, 'chart.svg'), A.chartSvg(participants, { synthetic }));

const c = A.collect(participants);
const far40 = A.falseAlarmRate(c, 40, 'test'), far65 = A.falseAlarmRate(c, 65, 'test');
console.log((synthetic ? '[SYNTHETIC – not real results] ' : '') + participants.length + ' participants analysed.');
console.log('Quick check false-alarm rate on sober retests: ' + (far40 == null ? '—' : Math.round(far40 * 100) + '%') + ' at 40, ' + (far65 == null ? '—' : Math.round(far65 * 100) + '%') + ' at 65.');
console.log('Wrote ' + path.relative(ROOT, path.join(dir, 'summary.md')) + ' and ' + path.relative(ROOT, path.join(dir, 'chart.svg')) + '.');
