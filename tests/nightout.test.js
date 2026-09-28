// Tests for Night Out mode logic.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/nightout.js');

const MIN = 60e3;
const at = (h, m) => new Date(2026, 8, 26, h, m, 0, 0).getTime(); // a Saturday evening

test('home-by time rolls over to tomorrow when it already passed', () => {
  assert.equal(N.parseHomeBy('23:30', at(21, 0)), at(23, 30));
  assert.equal(N.parseHomeBy('01:30', at(21, 0)), at(21, 0) + (4 * 60 + 30) * MIN);
  assert.equal(N.parseHomeBy('21:00', at(21, 0)), at(21, 0) + 24 * 60 * MIN, 'exactly now counts as passed');
  assert.equal(N.parseHomeBy('25:00', at(21, 0)), null);
  assert.equal(N.parseHomeBy('', at(21, 0)), null);
});

test('reminders every 90 minutes until home-by', () => {
  const start = at(21, 0), homeBy = at(21, 0) + 270 * MIN;
  assert.deepEqual(N.reminderTimes(start, homeBy, 90), [start + 90 * MIN, start + 180 * MIN]);
  assert.deepEqual(N.reminderTimes(start, start + 90 * MIN, 90), [], 'nothing at exactly home-by');
  assert.deepEqual(N.reminderTimes(start, homeBy, 0), [], 'reminders off');
});

test('sensitivity goes up one level, never past protective', () => {
  assert.equal(N.bumpSensitivity('gentle'), 'balanced');
  assert.equal(N.bumpSensitivity('balanced'), 'protective');
  assert.equal(N.bumpSensitivity('protective'), 'protective');
});

test('plan text uses the user’s own plan', () => {
  assert.equal(N.planText({ mode: 'cab', provider: 'uber' }), 'You planned to take an Uber home.');
  assert.equal(N.planText({ mode: 'cab', provider: 'ola' }), 'You planned to take an Ola home.');
  assert.equal(N.planText({ mode: 'cab', provider: 'rapido' }), 'You planned to take a Rapido home.');
  assert.equal(N.planText({ mode: 'friend', friend: 'Rahul' }), 'You planned to get a ride home with Rahul.');
  assert.ok(N.planText({ mode: 'walk' }).includes('not drive'));
  assert.equal(N.planText(null), '');
});

test('form validation', () => {
  const now = at(21, 0);
  assert.match(N.validateForm({}, now).error, /how you’re getting home/);
  assert.match(N.validateForm({ mode: 'cab' }, now).error, /time/);
  const ok = N.validateForm({ mode: 'cab', provider: 'rapido', homeBy: '01:30', everyMin: '90', note: '  Don’t drive  ' }, now);
  assert.equal(ok.plan.provider, 'rapido');
  assert.equal(ok.note, 'Don’t drive');
  assert.equal(ok.everyMin, 90);
  const friend = N.validateForm({ mode: 'friend', friend: '', homeBy: '23:00' }, now, 'Priya');
  assert.equal(friend.plan.friend, 'Priya');
  assert.ok(friend.plan.friendIsContact);
  assert.equal(N.validateForm({ mode: 'cab', homeBy: '23:00', everyMin: '7' }, now).everyMin, 90, 'odd values fall back to 90');
});

test('due reminders, skipped ones, overdue and auto-end', () => {
  const now = at(21, 0);
  const n = N.create(N.validateForm({ mode: 'walk', homeBy: '02:00', everyMin: '60' }, now), now, 'balanced');
  assert.equal(n.reminders.length, 4);
  assert.equal(N.dueReminder(n, now + 30 * MIN).due, null);
  const r = N.dueReminder(n, now + 125 * MIN); // laptop slept through the first one
  assert.equal(r.due.index, 1);
  assert.deepEqual(r.skipped, [0]);
  assert.equal(N.nextReminder(n, now + 30 * MIN), now + 60 * MIN);
  assert.ok(!N.isOverdue(n, n.homeBy + 10 * MIN));
  assert.ok(N.isOverdue(n, n.homeBy + 31 * MIN));
  assert.ok(!N.isOverdue(Object.assign({}, n, { overdueFired: true }), n.homeBy + 31 * MIN), 'fires once');
  assert.ok(N.isActive(n, n.homeBy + 11 * 60 * MIN));
  assert.ok(!N.isActive(n, n.homeBy + 13 * 60 * MIN), 'forgotten sessions end on their own');
  assert.ok(!N.isActive(Object.assign({}, n, { endedAt: now }), now));
});

test('flagged since the night started', () => {
  assert.ok(N.flaggedSince([{ at: 10 }, { at: 50 }], 40));
  assert.ok(!N.flaggedSince([{ at: 10 }], 40));
  assert.ok(!N.flaggedSince(undefined, 40));
});
