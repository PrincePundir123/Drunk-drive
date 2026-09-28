/* SecondLook — icons and "the eye", the product's signature element.
 * The logo (an eye with a pause in the pupil) doubles as a status display:
 *   level 'ok'      open eye, calm iris
 *   level 'caution' lid half lowered, warm iris
 *   level 'high'    lid lower, coral iris
 *   level 'count'   the iris ring is a countdown (progress 1 → 0)
 * Colours come from CSS tokens, so the same eye works in Sober and Night Mode. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLIcons = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var P = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M21 14a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    car: '<path d="M3 16v-3l2.2-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3L21 13v3a1 1 0 0 1-1 1h-1M3 16a1 1 0 0 0 1 1h1M8 17h8"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17.5" cy="17" r="1.8"/><path d="M4 12h16"/>',
    phone: '<path d="M5 4h3.5l2 5-2.5 1.6a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    message: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4L11.5 6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.4"/>',
    puzzle: '<path d="M9 4h4v2.5a1.5 1.5 0 0 0 3 0V4h4v5h-2.5a1.5 1.5 0 0 0 0 3H20v8h-6v-2.5a1.5 1.5 0 0 0-3 0V20H4v-6h2.5a1.5 1.5 0 0 0 0-3H4V4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    send: '<path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v7M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 8-7 8-3 0-5-2-6.5-4.5L2 13.5a1.5 1.5 0 0 1 2.5-1.5L8 15"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };

  function icon(name, label) {
    var body = P[name] || P.eye;
    return '<span class="ico"' + (label ? '' : ' aria-hidden="true"') + '><svg class="i" viewBox="0 0 24 24"' +
      (label ? ' role="img" aria-label="' + String(label).replace(/"/g, '') + '"' : ' aria-hidden="true" focusable="false"') + '>' + body + '</svg></span>';
  }

  var ALMOND = 'M6 38 C 28 6, 92 6, 114 38 C 92 70, 28 70, 6 38 Z';
  var R = 19, C = 2 * Math.PI * R;
  var LID = { ok: 0, count: 0, caution: 24, high: 32 };
  var uid = 0;

  /** opts: { level: 'ok'|'caution'|'high'|'count', progress: 0..1, label, className } */
  function eye(opts) {
    opts = opts || {};
    var level = LID.hasOwnProperty(opts.level) ? opts.level : 'ok';
    var prog = typeof opts.progress === 'number' ? Math.max(0, Math.min(1, opts.progress)) : 1;
    var lid = LID[level];
    var id = 'eyeclip' + (++uid);
    var a11y = opts.label ? ' role="img" aria-label="' + String(opts.label).replace(/"/g, '') + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="eye' + (opts.className ? ' ' + opts.className : '') + '" viewBox="0 0 120 76" data-level="' + level + '"' + a11y + '>' +
      '<defs><clipPath id="' + id + '"><path d="' + ALMOND + '"/></clipPath></defs>' +
      '<path class="eye-shape" d="' + ALMOND + '"/>' +
      '<g clip-path="url(#' + id + ')">' +
        '<circle class="eye-track" cx="60" cy="38" r="' + R + '"/>' +
        '<circle class="eye-iris" cx="60" cy="38" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - prog)).toFixed(2) + '" transform="rotate(-90 60 38)"/>' +
        '<circle class="eye-pupil" cx="60" cy="38" r="10"/>' +
        '<rect class="eye-bar" x="55.5" y="33" width="3" height="10" rx="1.5"/>' +
        '<rect class="eye-bar" x="61.5" y="33" width="3" height="10" rx="1.5"/>' +
        (lid ? '<path class="eye-lid" d="M-6 -6 H126 V' + (lid - 5) + ' Q60 ' + (lid + 9) + ' -6 ' + (lid - 5) + ' Z"/>' : '') +
      '</g>' +
      '<path class="eye-outline" d="' + ALMOND + '"/>' +
      '</svg>';
  }

  /** Update a countdown eye in place (no re-render). */
  function setProgress(svgEl, progress) {
    if (!svgEl) return;
    var iris = svgEl.querySelector('.eye-iris');
    if (iris) iris.setAttribute('stroke-dashoffset', (C * (1 - Math.max(0, Math.min(1, progress)))).toFixed(2));
  }

  return { icon: icon, eye: eye, setProgress: setProgress, PATHS: P };
});
