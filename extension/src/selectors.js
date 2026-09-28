/* SecondLook extension — ALL site-specific selectors live here.
 *
 * WhatsApp Web, Instagram and Gmail change their markup often. Each list is tried in
 * order, so put the most specific / most stable selector first and keep older ones as
 * fallbacks. If a site breaks, this is the only file that should need editing.
 *
 * Rules of thumb used below:
 *  - prefer ARIA roles/labels and data-* attributes over generated class names;
 *  - scope composer selectors so search boxes are NOT treated as message boxes;
 *  - text matching (sendTexts) is English-only and is the last resort.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLSelectors = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SITES = [
    {
      id: 'whatsapp',
      label: 'WhatsApp Web',
      hosts: ['web.whatsapp.com'],
      // Enter sends, Shift+Enter makes a new line.
      sendKey: 'enter',
      composer: [
        '#main footer div[contenteditable="true"][role="textbox"]', // current (Lexical editor)
        '#main footer div[contenteditable="true"]',                 // older builds
        'footer div[contenteditable="true"][data-tab="10"]',         // data-tab 10 = message box
        'div[contenteditable="true"][data-tab="10"]'
      ],
      sendButton: [
        'button[aria-label="Send"]',
        'span[data-icon="wds-ic-send-filled"]',
        'span[data-icon="send"]',
        '[data-testid="send"]',
        'button[data-tab="11"]'
      ],
      sendTexts: []
    },
    {
      id: 'instagram',
      label: 'Instagram DMs',
      hosts: ['www.instagram.com', 'instagram.com'],
      // Instagram is a single-page app: the content script is injected on every page
      // and only becomes active inside Direct messages.
      pathPattern: '^/direct/',
      sendKey: 'enter',
      composer: [
        'div[role="textbox"][contenteditable="true"][aria-label*="Message" i]',
        'div[role="textbox"][contenteditable="true"][aria-describedby]',
        'div[role="textbox"][contenteditable="true"]',
        'textarea[placeholder*="Message" i]'
      ],
      sendButton: [
        'div[role="button"][aria-label="Send"]',
        'button[aria-label="Send"]',
        'svg[aria-label="Send"]'
      ],
      sendTexts: ['Send']
    },
    {
      id: 'gmail',
      label: 'Gmail',
      hosts: ['mail.google.com'],
      // Enter is a new line in an email; Ctrl+Enter (Cmd+Enter on Mac) sends.
      sendKey: 'ctrlEnter',
      composer: [
        'div[g_editable="true"][role="textbox"]',       // language-independent
        'div[aria-label="Message Body"][contenteditable="true"]',
        'div.Am.Al.editable[contenteditable="true"]'
      ],
      sendButton: [
        'div[role="button"][data-tooltip^="Send"]',
        'div[role="button"][aria-label^="Send"]',
        'div.T-I.aoO[role="button"]'                     // class-based fallback
      ],
      sendTexts: ['Send']
    }
  ];

  // Sites the user enables from the popup use this.
  var GENERIC = {
    id: 'generic',
    label: 'This site',
    hosts: [],
    sendKey: 'enterOrCtrlEnter',
    composer: null, // any focused textarea or contenteditable
    sendButton: [
      'button[aria-label*="send" i]',
      '[role="button"][aria-label*="send" i]',
      '[data-testid*="send" i]',
      'button[type="submit"]'
    ],
    sendTexts: ['Send']
  };

  function detect(loc) {
    var host = String(loc && loc.hostname || '').toLowerCase();
    for (var i = 0; i < SITES.length; i++) {
      if (SITES[i].hosts.indexOf(host) >= 0) return SITES[i];
    }
    return GENERIC;
  }

  function isActivePath(site, loc) {
    if (!site.pathPattern) return true;
    return new RegExp(site.pathPattern).test(String(loc && loc.pathname || ''));
  }

  /** Does this key event mean "send" on this site? (plain object or KeyboardEvent) */
  function isSendKey(site, e) {
    if (!e || e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || e.altKey) return false;
    var mod = !!(e.ctrlKey || e.metaKey);
    if (site.sendKey === 'enter') return !e.shiftKey && !mod;
    if (site.sendKey === 'ctrlEnter') return mod && !e.shiftKey;
    return !e.shiftKey; // enterOrCtrlEnter
  }

  return { SITES: SITES, GENERIC: GENERIC, detect: detect, isActivePath: isActivePath, isSendKey: isSendKey };
});
