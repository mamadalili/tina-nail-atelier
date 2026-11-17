import assert from 'node:assert/strict';
import test from 'node:test';
import { periods } from '../src/content/salon';
import { bookingEndpoints } from '../src/features/booking/transport';
import { isUpcomingPeriod } from '../src/features/booking/model';
import { nextJalaliDay } from '../src/lib/jalali';
import { availableTimes, conflictAlternatives, parseBookingSnapshot, type BookingSlot } from '../src/features/booking/booking-options';

const atNoon = new Date('2026-11-03T08:30:00.001Z');
const today = '1405-08-12';
const tomorrow = '1405-08-13';
function times(taken: BookingSlot[], now = atNoon) {
  return availableTimes(parseBookingSnapshot({ asOf: now.toISOString(), taken }), now);
}

test('first times respect Tehran starts and each person’s own occupied periods', () => {
  const open = times([{ staff: 'tina', date: today, period: '14-16' }, { staff: 'tina', date: today, period: '16-18' }]);
  assert.deepEqual(open.sonia[0], { staff: 'sonia', date: today, period: '14-16' });
  assert.deepEqual(open.tina[0], { staff: 'tina', date: tomorrow, period: '10-12' });
  assert.equal(isUpcomingPeriod(today, '12-14', new Date('2026-11-03T08:30:00.000Z')), true);
  assert.equal(isUpcomingPeriod(today, '12-14', atNoon), false);
});

test('first time can be on day 90, and a fully occupied person has no suggestion', () => {
  const taken: BookingSlot[] = [];
  for (let date = today; date <= '1405-11-12'; date = nextJalaliDay(date)) {
    for (const period of periods) for (const staff of ['tina', 'sonia'] as const) {
      if (staff !== 'tina' || date !== '1405-11-12' || period.id !== '16-18') taken.push({ date, period: period.id, staff });
    }
  }
  const open = times(taken);
  assert.deepEqual(open.tina, [{ staff: 'tina', date: '1405-11-12', period: '16-18' }]);
  assert.deepEqual(open.sonia, []);
});

test('an available replacement is the closest to the requested start, preferring later on a tie', () => {
  const requested: BookingSlot = { staff: 'tina', date: tomorrow, period: '14-16' };
  const withTie = conflictAlternatives(requested, times([requested]));
  assert.deepEqual(withTie.nearest, { ...requested, period: '16-18' });
  assert.deepEqual(withTie.otherStaff, { ...requested, staff: 'sonia' });
  const beforeOnly = times([requested, { ...requested, staff: 'sonia' }, { ...requested, period: '16-18' }]);
  assert.deepEqual(conflictAlternatives(requested, beforeOnly), { nearest: { ...requested, period: '12-14' }, otherStaff: null });
  assert.deepEqual(conflictAlternatives(requested, { tina: [], sonia: [] }), { nearest: null, otherStaff: null });
});

test('an expired day, a malformed occupancy response and an unknown period do not offer slots', () => {
  const snapshot = parseBookingSnapshot({ asOf: atNoon.toISOString(), taken: [] });
  assert.deepEqual(availableTimes(snapshot, new Date('2026-11-03T20:30:00Z')), { tina: [], sonia: [] });
  assert.throws(() => parseBookingSnapshot({ asOf: atNoon.toISOString() }));
  assert.throws(() => parseBookingSnapshot({ asOf: atNoon.toISOString(), taken: [{ staff: 'tina', date: today, period: '11-13' }] }));
});

test('booking options use the deployed adapter and base path', () => {
  assert.equal(bookingEndpoints('shared-host', '/tina-preview/').options, '/tina-preview/api/options.php');
  assert.equal(bookingEndpoints(undefined).options, '/api/booking-options');
});
