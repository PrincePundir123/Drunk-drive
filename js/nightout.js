/* SecondLook — "Night Out" mode: pure helpers (no DOM, no storage).
 * A commitment device: while sober you write down how you'll get home; later the app
 * shows you your own plan instead of a lecture. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLNight = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = 60e3, HOUR = 60 * MIN;
  var OVERDUE_AFTER = 30 * MIN;   // no "Home safe" by home-by + 30 min → check-in
  var AUTO_END_AFTER = 12 * HOUR; // forgotten sessions end on their own
  var BUMP = { gentle: 'balanced', balanced: 'protective', protective: 'protective' };
  var PROVIDERS = { uber: 'Uber', ola: 'Ola', rapido: 'Rapido' };

  /** "01:30" → the next time it's 01:30 (today, or tomorrow if that already passed). */
  function parseHomeBy(hhmm, now) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    var d = new Date(now);
    d.setHours(h, mi, 0, 0);
    var t = d.getTime();
    if (t <= now) t += 24 * HOUR;
    return t;
  }

  /** Check-in times every `everyMin` minutes after the start, strictly before home-by. */
  function reminderTimes(start, homeBy, everyMin) {
    var out = [];
    if (!everyMin || everyMin <= 0) return out;
    for (var t = start + everyMin * MIN; t < homeBy; t += everyMin * MIN) out.push(t);
    return out;
  }

  function bumpSensitivity(s) { return BUMP[s] || 'protective'; }

  function isActive(n, now) {
    return !!n && !n.endedAt && typeof n.homeBy === 'number' && now < n.homeBy + AUTO_END_AFTER;
  }

  function isOverdue(n, now) {
    return isActive(n, now) && !n.overdueFired && now > n.homeBy + OVERDUE_AFTER;
  }

  /**
   * The reminder to act on now: the latest one that's due and still pending.
   * Older pending ones (e.g. the laptop was asleep) are returned as `skipped`.
   */
  function dueReminder(n, now) {
    if (!isActive(n, now)) return { due: null, skipped: [] };
    var due = null, skipped = [];
    (n.reminders || []).forEach(function (r, i) {
      if (r.status !== 'pending' || r.at > now) return;
      if (due) skipped.push(due.index);
      due = { index: i, at: r.at };
    });
    return { due: due, skipped: skipped };
  }

  function nextReminder(n, now) {
    var next = null;
    (n && n.reminders || []).forEach(function (r) { if (r.status === 'pending' && r.at > now && (!next || r.at < next)) next = r.at; });
    return next;
  }

  /** Plain-English plan, in the user's own terms. */
  function planText(plan, contactName) {
    if (!plan) return '';
    if (plan.mode === 'cab') return 'You planned to take ' + ({ uber: 'an Uber', ola: 'an Ola', rapido: 'a Rapido' }[plan.provider] || 'a cab') + ' home.';
    if (plan.mode === 'friend') return 'You planned to get a ride home with ' + (plan.friend || contactName || 'a friend') + '.';
    if (plan.mode === 'walk') return 'You planned to walk home — not drive.';
    if (plan.mode === 'stay') return 'You planned to stay over tonight — not drive.';
    return '';
  }

  /** Did anything get flagged since the night started? */
  function flaggedSince(flags, since) {
    return (flags || []).some(function (f) { return f.at >= since; });
  }

  /** Validate the form → { plan, homeBy, everyMin, note } or { error }. */
  function validateForm(f, now, contactName) {
    var modes = ['cab', 'friend', 'walk', 'stay'];
    if (modes.indexOf(f.mode) < 0) return { error: 'Choose how you’re getting home.' };
    var plan = { mode: f.mode };
    if (f.mode === 'cab') plan.provider = PROVIDERS[f.provider] ? f.provider : 'uber';
    if (f.mode === 'friend') {
      var friend = String(f.friend || '').trim().slice(0, 40);
      plan.friend = friend || contactName || '';
      plan.friendIsContact = !friend || friend === contactName;
      if (!plan.friend) return { error: 'Who’s giving you a ride?' };
    }
    var homeBy = parseHomeBy(f.homeBy, now);
    if (!homeBy) return { error: 'Pick the time you plan to be home.' };
    if (homeBy - now > 16 * HOUR) return { error: 'That’s more than 16 hours away — pick a time tonight.' };
    var every = Number(f.everyMin);
    if ([0, 60, 90, 120].indexOf(every) < 0) every = 90;
    return { plan: plan, homeBy: homeBy, everyMin: every, note: String(f.note || '').trim().slice(0, 120) };
  }

  function create(form, now, sensitivity) {
    return {
      startedAt: now,
      plan: form.plan,
      homeBy: form.homeBy,
      everyMin: form.everyMin,
      note: form.note,
      baseSensitivity: sensitivity,
      reminders: reminderTimes(now, form.homeBy, form.everyMin).map(function (t) { return { at: t, status: 'pending' }; }),
      overdueFired: false,
      endedAt: null
    };
  }

  return {
    OVERDUE_AFTER: OVERDUE_AFTER, AUTO_END_AFTER: AUTO_END_AFTER, PROVIDERS: PROVIDERS,
    parseHomeBy: parseHomeBy, reminderTimes: reminderTimes, bumpSensitivity: bumpSensitivity,
    isActive: isActive, isOverdue: isOverdue, dueReminder: dueReminder, nextReminder: nextReminder,
    planText: planText, flaggedSince: flaggedSince, validateForm: validateForm, create: create
  };
});
