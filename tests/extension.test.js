// Tests for the browser extension's pure pieces and its packaging.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEL = require('../extension/src/selectors.js');
const SH = require('../js/share.js');
const R = require('../js/rides.js');
const M = require('../js/metrics.js');
const { SHARED } = require('../scripts/sync-extension.js');

test('extension/lib copies are identical to js/ (run `npm run build:ext` if this fails)', () => {
  for (const f of SHARED) {
    const src = path.join(ROOT, 'js', f);
    if (!fs.existsSync(src)) continue;
    const a = fs.readFileSync(src);
    const b = fs.readFileSync(path.join(ROOT, 'extension', 'lib', f));
    assert.ok(a.equals(b), f + ' is out of date in extension/lib');
  }
});

test('manifest is valid and every referenced file exists', () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'));
  assert.equal(man.manifest_version, 3);
  assert.ok(!JSON.stringify(man).includes('<all_urls>'), 'no <all_urls> by default');
  const files = [man.background.service_worker, man.action.default_popup, ...Object.values(man.icons), ...man.content_scripts.flatMap(c => c.js)];
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, 'extension', f)), 'missing ' + f);
  // the popup registers the same scripts for user-enabled sites
  const popup = fs.readFileSync(path.join(ROOT, 'extension', 'popup', 'popup.js'), 'utf8');
  const list = JSON.parse(popup.match(/CONTENT_FILES = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(list, man.content_scripts[0].js);
});

test('site detection', () => {
  assert.equal(SEL.detect({ hostname: 'web.whatsapp.com' }).id, 'whatsapp');
  assert.equal(SEL.detect({ hostname: 'mail.google.com' }).id, 'gmail');
  assert.equal(SEL.detect({ hostname: 'www.instagram.com' }).id, 'instagram');
  assert.equal(SEL.detect({ hostname: 'discord.com' }).id, 'generic');
  const ig = SEL.detect({ hostname: 'www.instagram.com' });
  assert.ok(SEL.isActivePath(ig, { pathname: '/direct/t/123/' }));
  assert.ok(!SEL.isActivePath(ig, { pathname: '/explore/' }));
});

test('send keys per site', () => {
  const wa = SEL.detect({ hostname: 'web.whatsapp.com' });
  const gm = SEL.detect({ hostname: 'mail.google.com' });
  assert.ok(SEL.isSendKey(wa, { key: 'Enter' }));
  assert.ok(!SEL.isSendKey(wa, { key: 'Enter', shiftKey: true }), 'Shift+Enter is a new line');
  assert.ok(!SEL.isSendKey(wa, { key: 'Enter', isComposing: true }), 'IME composition is ignored');
  assert.ok(!SEL.isSendKey(wa, { key: 'a' }));
  assert.ok(!SEL.isSendKey(gm, { key: 'Enter' }), 'Enter is a new line in Gmail');
  assert.ok(SEL.isSendKey(gm, { key: 'Enter', ctrlKey: true }));
  assert.ok(SEL.isSendKey(gm, { key: 'Enter', metaKey: true }));
});

function sampleBaseline() {
  const s = M.seeded;
  return {
    test: { reactionMs: s(300, 40, 5) },
    chat: { ikiMs: s(210, 45, 12), ikiCv: s(0.65, 0.15, 12), backspaceRate: s(0.09, 0.06, 12), pauseRate: s(0.5, 0.5, 12), oddWordRate: s(0.06, 0.06, 12) }
  };
}
const profile = { name: 'Riya', contact: { name: 'Kabir', phone: '+91 1' }, homeAddress: '12 MG Road', settings: { sensitivity: 'protective', nudgeTimeout: 30 } };

test('baseline export round-trips through the code and contains no text fields', () => {
  const data = SH.buildBaselineExport({ baseline: sampleBaseline(), profile, flags: [{ at: 1000 }], appUrl: 'https://x.github.io/secondlook/', now: 5 });
  const code = SH.encodeCode(SH.BASELINE_PREFIX, data);
  assert.ok(code.startsWith('SLB1.'));
  const back = SH.validateBaselineExport(SH.decodeCode(code, SH.BASELINE_PREFIX));
  assert.equal(back.name, 'Riya');
  assert.equal(back.settings.sensitivity, 'protective');
  assert.equal(back.settings.nudgeTimeout, 30);
  assert.equal(back.lockUntil, 1000 + 6 * 3600e3);
  assert.equal(Object.keys(back.chat).length, 5);
  assert.ok(!('vocab' in back) && !('messages' in back));
  // unicode survives
  const uni = SH.decodeCode(SH.encodeCode('X.', { n: 'प्रिया 😀' }), 'X.');
  assert.equal(uni.n, 'प्रिया 😀');
});

test('baseline import rejects junk with friendly errors', () => {
  assert.throws(() => SH.decodeCode('', SH.BASELINE_PREFIX), /Nothing/);
  assert.throws(() => SH.decodeCode('hello', SH.BASELINE_PREFIX), /doesn’t look like/);
  assert.throws(() => SH.decodeCode('SLB1.@@@', SH.BASELINE_PREFIX), /damaged/);
  assert.throws(() => SH.validateBaselineExport({ kind: 'nope' }), /isn’t a SecondLook baseline/);
  assert.throws(() => SH.validateBaselineExport({ kind: 'secondlook-baseline', v: 1, chat: {} }), /missing typing data/);
  const cleaned = SH.validateBaselineExport(Object.assign(SH.buildBaselineExport({ baseline: sampleBaseline(), profile, appUrl: 'javascript:alert(1)' }), { settings: { sensitivity: 'evil', nudgeTimeout: 1 } }));
  assert.equal(cleaned.appUrl, '', 'only http(s)/file app URLs are accepted');
  assert.equal(cleaned.settings.sensitivity, 'balanced');
  assert.equal(cleaned.settings.nudgeTimeout, 45);
});

test('extension log merge: prefix, dedupe, sort, skip malformed', () => {
  const existing = [{ at: 10, type: 'setup', text: 'set up' }];
  const imported = SH.buildLogExport([
    { at: 20, type: 'nudge', text: 'Paused a message' },
    { at: 20, type: 'nudge', text: 'Paused a message' },
    { at: 'x', text: 'bad' },
    { at: 5, text: 42 }
  ]);
  const r1 = SH.mergeLogs(existing, imported);
  assert.equal(r1.added, 1);
  assert.equal(r1.log[0].text, '[Extension] Paused a message');
  assert.equal(r1.log[0].type, 'extension');
  const r2 = SH.mergeLogs(r1.log, imported);
  assert.equal(r2.added, 0, 'importing twice adds nothing');
  assert.throws(() => SH.mergeLogs([], { foo: 1 }), /isn’t a SecondLook extension log/);
});

test('ride links', () => {
  assert.equal(R.uberUrl({ address: '12 MG Road' }), 'https://m.uber.com/', 'no coordinates → plain Uber');
  const u = R.uberUrl({ address: '12 MG Road', home: { lat: 12.97, lng: 77.59 } });
  assert.ok(u.startsWith('https://m.uber.com/looking?drop%5B0%5D='));
  const drop = JSON.parse(decodeURIComponent(u.split('=')[1]));
  assert.deepEqual(drop, { latitude: 12.97, longitude: 77.59, addressLine1: '12 MG Road' });
  assert.equal(R.uberUrl({ home: { lat: 999, lng: 0 } }), 'https://m.uber.com/', 'bad coordinates are ignored');
  const opts = R.rideOptions({ address: '12 MG Road' });
  assert.ok(opts.find(o => o.id === 'uber').copyAddress);
  assert.ok(opts.find(o => o.id === 'ola').copyAddress);
  assert.ok(!R.rideOptions({}).some(o => o.copyAddress), 'nothing to copy without an address');
  assert.equal(R.telUrl('+91 98765-43210'), 'tel:+919876543210');
  assert.equal(R.emergencyUrl(), 'tel:112');
  assert.equal(R.waUrl('+91 98765', 'hi there'), 'https://wa.me/9198765?text=hi%20there');
});
