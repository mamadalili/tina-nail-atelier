import test from 'node:test';
import assert from 'node:assert/strict';
import { daySlots, validDateChange, monthSummary, mutationRecovery } from '../src/features/admin/model';

test('daily slots distinguish bookings, blocks and cancellation without hiding empty hours', () => {
  const active = { reference: 'TN-AAAAAAAAAAAAAAAA', staff: 'tina', status: 'CONFIRMED', version: 1, name: 'مهمان', phone: '09000000000', service: 'pedicure', manicureType: '', date: '1405-08-16', period: '12-14', note: '', issuedAt: '2026-11-04T08:00:00Z', updatedAt: null } as const;
  const slots = daySlots('1405-08-16', [active, { ...active, reference: 'TN-BBBBBBBBBBBBBBBB', status: 'CANCELLED', period: '10-12' }], [{ date: '1405-08-16', period: '14-16' }]);
  assert.deepEqual(slots.map(slot => slot.kind), ['free', 'appointment', 'blocked', 'free']);
  assert.equal(slots[1].appointment?.reference, active.reference);
  assert.deepEqual(monthSummary([active], [{ date: '1405-08-16', period: '14-16' }])['1405-08-16'], { booked: 1, blocked: 1 });
});
test('stale edits and unknown outcomes require a fresh record before another change', () => {
  assert.deepEqual(mutationRecovery(409, 'STALE_BOOKING'), { closeDialog: true, refreshCalendar: true });
  assert.deepEqual(mutationRecovery(undefined), { closeDialog: true, refreshCalendar: true });
  assert.deepEqual(mutationRecovery(409, 'SLOT_TAKEN'), { closeDialog: false, refreshCalendar: true });
  assert.deepEqual(mutationRecovery(422, 'VALIDATION'), { closeDialog: false, refreshCalendar: false });
});
test('Persian date selectors clamp invalid leap/month-end days', () => {
  assert.equal(validDateChange('1403-12-30', 'year', 1404), '1404-12-29');
  assert.equal(validDateChange('1405-06-31', 'month', 7), '1405-07-30');
  assert.equal(validDateChange('1405-08-16', 'day', 17), '1405-08-17');
});
