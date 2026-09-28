/* SecondLook — tiny storage wrapper.
 * Everything lives in this browser's localStorage. If storage is blocked
 * (private mode, strict settings) we fall back to memory so the app still works. */
(function (root) {
  'use strict';

  var PREFIX = 'secondlook.v1.';
  var memory = {};

  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return key in memory ? memory[key] : fallback;
      return JSON.parse(raw);
    } catch (e) {
      return key in memory ? memory[key] : fallback;
    }
  }

  function set(key, value) {
    memory[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* memory only */ }
  }

  function remove(key) {
    delete memory[key];
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  }

  function clearAll() {
    memory = {};
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(PREFIX) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  root.SLStore = { get: get, set: set, remove: remove, clearAll: clearAll };
})(typeof self !== 'undefined' ? self : this);
