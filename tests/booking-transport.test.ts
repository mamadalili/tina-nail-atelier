import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingEndpoints, bookingFailureErrors } from '../src/features/booking/transport';

test('shared hosting uses its own PHP API beneath the preview path', () => {
  const urls = bookingEndpoints('shared-host', '/tina-preview');
  assert.equal(urls.appointment, '/tina-preview/api/booking.php');
  assert.equal(urls.availability('1405-08-14'), '/tina-preview/api/booking.php?date=1405-08-14');
});
test('non-field backend errors remain visible even with empty field errors', () => {
  assert.deepEqual(bookingFailureErrors({ message: 'کمی بعد دوباره تلاش کن.', errors: [] }), { form: 'کمی بعد دوباره تلاش کن.' });
  assert.deepEqual(bookingFailureErrors({ message: 'دوباره ثبت کن.', errors: {} }), { form: 'دوباره ثبت کن.' });
  assert.deepEqual(bookingFailureErrors({ errors: { period: 'رزرو شده' } }), { period: 'رزرو شده' });
});
test('Node deployment keeps its original API routes', () => {
  const urls = bookingEndpoints(undefined);
  assert.equal(urls.appointment, '/api/appointment-requests');
  assert.equal(urls.availability('1405-08-14'), '/api/availability?date=1405-08-14');
});
