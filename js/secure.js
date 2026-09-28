/* SecondLook — end-to-end encryption for the contact link.
 *
 * - Topics: 128 random bits, base32 (26 chars), from crypto.getRandomValues. Unguessable.
 * - Key: 256-bit AES-GCM, generated on the user's device. It travels ONLY in the URL
 *   fragment (#k=…) of the link the user shares with their contact. Browsers never send
 *   the fragment to any server, so ntfy.sh only ever sees ciphertext.
 * - Every payload: "SL1." + base64url(12-byte IV || AES-GCM ciphertext).
 *
 * Works in browsers and Node 20+ (globalThis.crypto). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLSecure = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PREFIX = 'SL1.';
  var AAD = new TextEncoder().encode('secondlook-v1');
  var B32 = 'abcdefghijklmnopqrstuvwxyz234567';

  function cryptoObj() {
    var c = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (!c || !c.subtle || !c.getRandomValues) throw new Error('This browser can’t do encryption here. Open SecondLook over https (or localhost).');
    return c;
  }

  function randomBytes(n) { var b = new Uint8Array(n); cryptoObj().getRandomValues(b); return b; }

  function base32(bytes) {
    var out = '', bits = 0, value = 0;
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }

  function bytesToB64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(str) {
    var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function newTopic() { return base32(randomBytes(16)); }          // 128 bits → 26 chars
  function isTopic(t) { return /^[a-z2-7]{26}$/.test(String(t || '')); }
  function isKey(k) { try { return b64urlToBytes(k).length === 32; } catch (e) { return false; } }

  /** A fresh contact link: two topics and one key. */
  function newLink() {
    return { alertTopic: newTopic(), replyTopic: newTopic(), key: bytesToB64url(randomBytes(32)), createdAt: Date.now() };
  }

  /** Encrypted payloads go to a sub-topic so the contact's ntfy app only shows the friendly notification. */
  function dataTopic(alertTopic) { return alertTopic + '-d'; }

  function importKey(keyB64) {
    return cryptoObj().subtle.importKey('raw', b64urlToBytes(keyB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  function encrypt(keyB64, obj) {
    var iv = randomBytes(12);
    var data = new TextEncoder().encode(JSON.stringify(obj));
    return importKey(keyB64)
      .then(function (key) { return cryptoObj().subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: AAD }, key, data); })
      .then(function (ct) {
        var buf = new Uint8Array(12 + ct.byteLength);
        buf.set(iv, 0);
        buf.set(new Uint8Array(ct), 12);
        return PREFIX + bytesToB64url(buf);
      });
  }

  /** Resolves to the object, or rejects with Error('decrypt') if the key is wrong or data was tampered with. */
  function decrypt(keyB64, str) {
    return Promise.resolve().then(function () {
      if (typeof str !== 'string' || str.indexOf(PREFIX) !== 0) throw new Error('format');
      var buf = b64urlToBytes(str.slice(PREFIX.length));
      if (buf.length < 13) throw new Error('format');
      return importKey(keyB64).then(function (key) {
        return cryptoObj().subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12), additionalData: AAD }, key, buf.slice(12));
      });
    }).then(function (plain) {
      return JSON.parse(new TextDecoder().decode(plain));
    }, function (e) {
      throw new Error(e && e.message === 'format' ? 'format' : 'decrypt');
    });
  }

  function isCiphertext(s) { return typeof s === 'string' && s.indexOf(PREFIX) === 0; }

  /** Contact page URL: ?a=&r= in the query (safe to share with ntfy), key only in the #fragment. */
  function contactUrl(base, link, withKey) {
    var u = String(base).split('#')[0].split('?')[0];
    return u + '?a=' + link.alertTopic + '&r=' + link.replyTopic + (withKey ? '#k=' + link.key : '');
  }

  function parseContactUrl(search, hash) {
    var q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    var h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    var a = q.get('a'), r = q.get('r'), k = h.get('k');
    return {
      alertTopic: isTopic(a) ? a : null,
      replyTopic: isTopic(r) ? r : null,
      key: k && isKey(k) ? k : null
    };
  }

  return {
    PREFIX: PREFIX, base32: base32, bytesToB64url: bytesToB64url, b64urlToBytes: b64urlToBytes,
    newTopic: newTopic, isTopic: isTopic, isKey: isKey, newLink: newLink, dataTopic: dataTopic,
    encrypt: encrypt, decrypt: decrypt, isCiphertext: isCiphertext,
    contactUrl: contactUrl, parseContactUrl: parseContactUrl
  };
});
