/* SecondLook — one place for every "get home" and emergency link.
 * Used by the web app (check-in, Night Out), the contact view and the browser extension.
 *
 * Uber: its current deep-link docs use https://m.uber.com/looking?drop[0]=<Location JSON>
 * where the location has latitude/longitude. We can only fill that in when the user saved
 * home coordinates (from their own device, while sober). With just a typed address we
 * can't geocode without a server, so we open plain m.uber.com and copy the address. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLRides = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EMERGENCY_NUMBER = '112'; // India's single emergency number (also works across the EU)

  function hasCoords(home) {
    return !!home && typeof home.lat === 'number' && typeof home.lng === 'number' &&
      isFinite(home.lat) && isFinite(home.lng) && Math.abs(home.lat) <= 90 && Math.abs(home.lng) <= 180;
  }

  function uberUrl(opts) {
    opts = opts || {};
    if (!hasCoords(opts.home)) return 'https://m.uber.com/';
    var drop = { latitude: opts.home.lat, longitude: opts.home.lng, addressLine1: String(opts.address || 'Home').slice(0, 140) };
    return 'https://m.uber.com/looking?drop%5B0%5D=' + encodeURIComponent(JSON.stringify(drop));
  }

  /**
   * opts: { address, home: {lat,lng} }
   * Returns [{ id, name, url, copyAddress }] — copyAddress means "put the home address on
   * the clipboard when this is opened, because the link can't carry it".
   */
  function rideOptions(opts) {
    opts = opts || {};
    var addr = String(opts.address || '').trim();
    var coords = hasCoords(opts.home);
    return [
      { id: 'uber', name: 'Uber', url: uberUrl(opts), copyAddress: !!addr && !coords, prefilled: coords },
      { id: 'ola', name: 'Ola', url: 'https://book.olacabs.com/', copyAddress: !!addr, prefilled: false },
      { id: 'rapido', name: 'Rapido', url: 'https://www.rapido.bike/', copyAddress: !!addr, prefilled: false },
      { id: 'lyft', name: 'Lyft', url: 'https://ride.lyft.com/', copyAddress: !!addr, prefilled: false },
      { id: 'taxi', name: 'Taxis near me', url: 'https://www.google.com/maps/search/taxi+near+me', copyAddress: false, prefilled: false }
    ];
  }

  function rideById(id, opts) {
    var list = rideOptions(opts);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function cleanPhone(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function telUrl(phone) { return 'tel:' + cleanPhone(phone); }
  function smsUrl(phone, body) { return 'sms:' + cleanPhone(phone) + '?&body=' + encodeURIComponent(body || ''); }
  function waUrl(phone, body) { return 'https://wa.me/' + cleanPhone(phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(body || ''); }
  function emergencyUrl() { return 'tel:' + EMERGENCY_NUMBER; }

  /** Copy text; works in secure contexts (clipboard API) and on file:// (execCommand fallback). */
  function copyText(text) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && (typeof isSecureContext === 'undefined' || isSecureContext)) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }

  return {
    EMERGENCY_NUMBER: EMERGENCY_NUMBER,
    hasCoords: hasCoords, uberUrl: uberUrl, rideOptions: rideOptions, rideById: rideById,
    telUrl: telUrl, smsUrl: smsUrl, waUrl: waUrl, emergencyUrl: emergencyUrl, cleanPhone: cleanPhone,
    copyText: copyText
  };
});
