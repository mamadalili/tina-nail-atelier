import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { monthCells, shiftMonth, todayInTehran, toGregorianDay, isAllowedDay } from '../src/lib/jalali';
import { normalizeDigits, validateRequest, validateSubmission, whatsappRequestUrl } from '../src/features/booking/model';

test('Tehran today changes at Iran midnight instead of UTC midnight', () => {
  assert.equal(todayInTehran(new Date('2026-11-02T20:29:59Z')), '1405-08-11');
  assert.equal(todayInTehran(new Date('2026-11-02T20:30:00Z')), '1405-08-12');
});

test('Jalali calendar preserves leap Esfand and rolls Farvardin across the year', () => {
  assert.equal(monthCells(1403, 12).filter(Boolean).length, 30);
  assert.equal(monthCells(1404, 12).filter(Boolean).length, 29);
  assert.deepEqual(shiftMonth(1404, 12, 1), { year: 1405, month: 1 });
  assert.deepEqual(shiftMonth(1405, 1, -1), { year: 1404, month: 12 });
  assert.equal(toGregorianDay('1405-01-01'), '2026-03-21');
});

test('booking days reject past, invalid dates and dates outside 90 days', () => {
  assert.equal(isAllowedDay('1405-08-11', '1405-08-12'), false);
  assert.equal(isAllowedDay('1405-08-12', '1405-08-12'), true);
  assert.equal(isAllowedDay('1405-12-30', '1405-08-12'), false);
  assert.equal(isAllowedDay('1406-08-12', '1405-08-12'), false);
});

test('Persian and Arabic phone digits normalize to an Iranian mobile', () => {
  assert.equal(normalizeDigits('۰۹۳۵۳۱۵۵۸۵۲'), '09353155852');
  assert.equal(normalizeDigits('٠٩٣٥٣١٥٥٨٥٢'), '09353155852');
  const result = validateRequest({ name: 'آزمایش', phone: '۰۹۳۵۳۱۵۵۸۵۲', service: 'manicure', manicureType: 'gel', date: '1405-08-13', period: '12-14', note: '', consent: true }, '1405-08-12');
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.phone, '09353155852');
});

test('requests require consent, a real service, valid phone and preferred day', () => {
  const result = validateRequest({ name: 'آ', phone: '123', service: 'fake', date: '1404-01-01', period: 'night', consent: false }, '1405-08-12');
  assert.equal(result.success, false);
  if (!result.success) for (const field of ['name', 'phone', 'service', 'date', 'period', 'consent']) assert.ok(result.errors[field]);
});

test('WhatsApp prepares a request, not a confirmed booking, for the real owner number', () => {
  const url = new URL(whatsappRequestUrl({ name: 'آزمایش', phone: '09353155852', service: 'pedicure', manicureType: '', date: '1405-08-13', period: '16-18', note: '', consent: true }));
  assert.equal(url.pathname, '/989353155852');
  assert.match(url.searchParams.get('text')!, /درخواست وقت/);
  assert.match(url.searchParams.get('text')!, /پدیکور/);
  assert.doesNotMatch(url.searchParams.get('text')!, /رزرو قطعی/);
});

test('submission revalidates a once-valid preferred day after Tehran midnight', () => {
  const request = { name: 'بازبینی', phone: '09353155852', service: 'pedicure', manicureType: '', date: '1405-08-12', period: '10-12', note: '', consent: true };
  assert.equal(validateSubmission(request, new Date('2026-11-02T20:29:59Z')).success, true);
  const afterMidnight = validateSubmission(request, new Date('2026-11-02T20:30:00Z'));
  assert.equal(afterMidnight.success, true);
  const nextDay = validateSubmission(request, new Date('2026-11-03T20:30:00Z'));
  assert.equal(nextDay.success, false);
  if (!nextDay.success) assert.ok(nextDay.errors.date);
});

const manicureRequest = { name: 'آزمایش', phone: '09353155852', service: 'manicure', manicureType: 'gel', date: '1405-08-12', period: '10-12', note: '', consent: true };

test('manicure requires gel or extensions; pedicure removes an irrelevant manicure choice', () => {
  for (const manicureType of ['', 'other']) {
    const result = validateRequest({ ...manicureRequest, manicureType }, '1405-08-12');
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.errors.manicureType);
  }
  for (const manicureType of ['gel', 'extensions']) assert.equal(validateRequest({ ...manicureRequest, manicureType }, '1405-08-12').success, true);
  const pedicure = validateRequest({ ...manicureRequest, service: 'pedicure' }, '1405-08-12');
  assert.equal(pedicure.success, true);
  if (pedicure.success) assert.equal(pedicure.data.manicureType, '');
});

test('only the four two-hour windows from 10 to 18 are accepted', () => {
  for (const period of ['10-12', '12-14', '14-16', '16-18']) assert.equal(validateRequest({ ...manicureRequest, period }, '1405-08-12').success, true);
  for (const period of ['', 'flexible', '09-11', '10-14', '18-20']) {
    const result = validateRequest({ ...manicureRequest, period }, '1405-08-12');
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.errors.period);
  }
});

test('elapsed windows are rejected against Tehran time on both submission paths', () => {
  assert.equal(validateSubmission(manicureRequest, new Date('2026-11-03T06:30:00Z')).success, true);
  const elapsed = validateSubmission(manicureRequest, new Date('2026-11-03T06:30:01Z'));
  assert.equal(elapsed.success, false);
  if (!elapsed.success) assert.ok(elapsed.errors.period);
  assert.equal(validateSubmission({ ...manicureRequest, period: '12-14' }, new Date('2026-11-03T06:30:01Z')).success, true);
  assert.equal(validateSubmission({ ...manicureRequest, date: '1405-08-13' }, new Date('2026-11-03T15:00:00Z')).success, true);
});

test('prepared request preserves the manicure treatment and exact time window', () => {
  const valid = validateRequest({ ...manicureRequest, manicureType: 'extensions', period: '14-16' }, '1405-08-12');
  assert.equal(valid.success, true);
  if (valid.success) {
    const message = new URL(whatsappRequestUrl(valid.data)).searchParams.get('text')!;
    assert.match(message, /خدمات مانیکور/);
    assert.match(message, /کاشت/);
    assert.match(message, /۱۴ تا ۱۶/);
  }
});
