// Tests for end-to-end encryption, topics, contact links and the QR encoder.
const test = require('node:test');
const assert = require('node:assert/strict');
const SEC = require('../js/secure.js');
const QR = require('../js/qr.js');

test('topics are 128-bit base32, unguessable and unique', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = SEC.newTopic();
    assert.match(t, /^[a-z2-7]{26}$/);
    assert.ok(!seen.has(t));
    seen.add(t);
  }
  assert.equal(SEC.base32(new Uint8Array([0xff, 0x00])), '74aa');
  assert.ok(SEC.isTopic(SEC.newTopic()));
  assert.ok(!SEC.isTopic('secondlook-abc'), 'old style topics are rejected');
});

test('new link has two different topics and a 256-bit key', () => {
  const l = SEC.newLink();
  assert.notEqual(l.alertTopic, l.replyTopic);
  assert.equal(SEC.b64urlToBytes(l.key).length, 32);
  assert.ok(SEC.isKey(l.key));
  assert.equal(SEC.dataTopic(l.alertTopic), l.alertTopic + '-d');
});

test('encrypt → decrypt round-trip, and ciphertext reveals nothing', async () => {
  const { key } = SEC.newLink();
  const msg = { t: 'alert', name: 'Riya', reason: 'no response', loc: 'https://maps.google.com/?q=12.9,77.5' };
  const ct = await SEC.encrypt(key, msg);
  assert.ok(ct.startsWith('SL1.'));
  assert.ok(!/Riya|maps|response/.test(ct));
  assert.deepEqual(await SEC.decrypt(key, ct), msg);
  const ct2 = await SEC.encrypt(key, msg);
  assert.notEqual(ct, ct2, 'fresh IV every time');
});

test('wrong key, tampering and junk are rejected', async () => {
  const a = SEC.newLink().key, b = SEC.newLink().key;
  const ct = await SEC.encrypt(a, { t: 'reply', action: 'on_my_way' });
  await assert.rejects(SEC.decrypt(b, ct), /decrypt/);
  const bytes = SEC.b64urlToBytes(ct.slice(4));
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(SEC.decrypt(a, 'SL1.' + SEC.bytesToB64url(bytes)), /decrypt/);
  await assert.rejects(SEC.decrypt(a, 'hello'), /format/);
  await assert.rejects(SEC.decrypt(a, 'SL1.AAAA'), /format/);
});

test('contact URL keeps the key in the fragment only', () => {
  const l = SEC.newLink();
  const withKey = SEC.contactUrl('https://x.github.io/secondlook/contact.html', l, true);
  const noKey = SEC.contactUrl('https://x.github.io/secondlook/contact.html?old=1#junk', l, false);
  assert.ok(withKey.includes('#k=' + l.key));
  assert.ok(!noKey.includes(l.key), 'the notification click URL never carries the key');
  assert.ok(!noKey.includes('old=1'));
  const u = new URL(withKey);
  const parsed = SEC.parseContactUrl(u.search, u.hash);
  assert.deepEqual(parsed, { alertTopic: l.alertTopic, replyTopic: l.replyTopic, key: l.key });
  assert.deepEqual(SEC.parseContactUrl('?a=bad&r=bad', '#k=short'), { alertTopic: null, replyTopic: null, key: null });
});

test('QR encoder: sizes, finder patterns, capacity', () => {
  const small = QR.encode('hi', 'M');
  assert.equal(small.version, 1);
  assert.equal(small.size, 21);
  // top-left finder: dark ring, light ring, dark 3x3 core
  const m = small.modules;
  assert.ok(m[0][0] && m[0][6] && m[6][0] && m[6][6]);
  assert.ok(!m[1][1] && !m[5][5]);
  assert.ok(m[3][3]);
  const link = 'https://someone.github.io/secondlook/contact.html?a=' + 'a'.repeat(26) + '&r=' + 'b'.repeat(26) + '#k=' + 'c'.repeat(43);
  const q = QR.encode(link, 'M');
  assert.ok(q.version >= 7 && q.version <= 10, 'contact link fits a small code (v' + q.version + ')');
  assert.equal(q.size, q.version * 4 + 17);
  assert.throws(() => QR.encode('x'.repeat(4000), 'H'), /too long/);
  const svg = QR.toSvg('hi', { label: 'test' });
  assert.ok(svg.startsWith('<svg') && svg.includes('aria-label="test"'));
});
