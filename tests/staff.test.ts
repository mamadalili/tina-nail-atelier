import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRequest } from '../src/features/booking/model';
import { bookingEndpoints } from '../src/features/booking/transport';
import { receiptFor } from '../src/features/booking/receipt-model';

const body = { name: 'مهمان آزمایشی', phone: '09000000000', service: 'pedicure', manicureType: '', date: '1405-08-20', period: '12-14', note: '', consent: true };
test('person is validated and legacy requests belong to Tina', () => {
  const legacy = validateRequest(body, '1405-08-13');
  assert.ok(legacy.success && legacy.data.staff === 'tina');
  const sonia = validateRequest({ ...body, staff: 'sonia' }, '1405-08-13');
  assert.ok(sonia.success && sonia.data.staff === 'sonia');
  assert.equal(validateRequest({ ...body, staff: 'other' }, '1405-08-13').success, false);
});
test('availability URLs preserve the selected person', () => {
  assert.match(bookingEndpoints('shared-host', '/tina-preview').availability(body.date, 'sonia'), /staff=sonia/);
});
test('receipt includes the Persian name of the selected person', () => {
  const receipt = receiptFor({ reference: 'TN-AAAAAAAAAAAAAAAA', status: 'CONFIRMED', name: body.name, service: body.service, manicureType: '', staff: 'sonia', jalaliDay: body.date, period: body.period, createdAt: new Date('2026-11-04T08:00:00Z') });
  assert.equal(receipt.staffName, 'سونیا');
});
