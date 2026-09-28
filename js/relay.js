/* SecondLook — the only network code in the app: publish to / listen on ntfy.sh.
 * Used only after the user has opted in to the contact link. Everything sent here is
 * either AES-GCM ciphertext or a generic "may need help" notification. */
(function (root) {
  'use strict';

  var BASE = 'https://ntfy.sh';

  function qs(params) {
    return Object.keys(params || {}).filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  }

  /** POST a message. Plain-text body keeps it a "simple" CORS request (no preflight). Resolves true/false. */
  function publish(topic, body, params) {
    var q = qs(params);
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
    return fetch(BASE + '/' + encodeURIComponent(topic) + (q ? '?' + q : ''), { method: 'POST', body: body, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
  }

  /**
   * Listen for messages on one or more topics since a unix time (seconds).
   * onMessage({id, time, topic, message}); onStatus('open' | 'reconnecting' | 'offline').
   * Uses Server-Sent Events, or polling if EventSource isn't available.
   */
  function subscribe(topics, sinceSec, onMessage, onStatus) {
    var closed = false, es = null, pollTimer = null, since = String(sinceSec || 'all'), seen = {};
    var path = BASE + '/' + topics.map(encodeURIComponent).join(',');
    function status(s) { try { if (onStatus) onStatus(s); } catch (e) { /* ignore */ } }
    function handle(m) {
      if (!m || m.event !== 'message' || seen[m.id]) return;
      seen[m.id] = true;
      try { onMessage(m); } catch (e) { /* a bad message must not stop the stream */ }
    }
    function poll() {
      if (closed) return;
      fetch(path + '/json?poll=1&since=' + encodeURIComponent(since))
        .then(function (r) { if (!r.ok) throw new Error('http'); return r.text(); })
        .then(function (text) {
          status('open');
          text.split('\n').forEach(function (line) {
            if (!line.trim()) return;
            try { var m = JSON.parse(line); handle(m); if (m.id) since = m.id; } catch (e) { /* skip */ }
          });
        })
        .catch(function () { status(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'reconnecting'); })
        .then(function () { if (!closed) pollTimer = setTimeout(poll, 8000); });
    }
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(path + '/sse?since=' + encodeURIComponent(since));
      es.onopen = function () { status('open'); };
      es.onerror = function () { status(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'reconnecting'); };
      es.onmessage = function (ev) { try { handle(JSON.parse(ev.data)); } catch (e) { /* skip */ } };
    } else {
      poll();
    }
    return {
      close: function () {
        closed = true;
        if (es) es.close();
        clearTimeout(pollTimer);
      }
    };
  }

  root.SLRelay = { BASE: BASE, publish: publish, subscribe: subscribe };
})(typeof self !== 'undefined' ? self : this);
