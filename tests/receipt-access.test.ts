import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receiptFor, currentReceiptFor, receiptSchema, savedReceiptSchema } from '../src/features/booking/receipt-model';
import { receiptCalendar } from '../src/features/booking/receipt-calendar';
import { fetchBookingReceipt, listBookingReceipts, rememberBookingReceipt } from '../src/features/booking/receipt-access';

const record = { reference: 'TN-1234567890ABCDEF', status: 'CONFIRMED', name: 'مهمان آزمایشی', service: 'manicure', receiptServiceName: 'خدمات دست', manicureType: null, jalaliDay: '1405-08-14', period: '12-14', createdAt: new Date('2026-11-04T08:00:00Z'), updatedAt: new Date('2026-11-04T09:00:00Z') };
const first = { reference: record.reference, requestKey: '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff101' };
const second = { reference: 'TN-ABCD123456789000', requestKey: '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff102' };

test('a reopened receipt uses current status, staff and slot while creation still requires confirmation', () => {
  const moved = currentReceiptFor({ ...record, status: 'CANCELLED', period: '16-18', jalaliDay: '1405-08-15', staff: 'sonia' });
  assert.equal(moved.date, '1405-08-15');
  assert.equal(moved.startsAt, '2026-11-06T12:30:00.000Z');
  assert.equal(moved.staffName, 'سونیا');
  assert.equal(moved.status, 'CANCELLED');
  assert.equal(moved.updatedAt, '2026-11-04T09:00:00.000Z');
  assert.ok(savedReceiptSchema.safeParse(moved).success);
  assert.equal(receiptSchema.safeParse(moved).success, false);
  assert.throws(() => receiptFor({ ...record, status: 'CANCELLED' }));
});

test('the calendar uses UTC instants, stable event identity and escaped, byte-folded Persian text', () => {
  const original = receiptFor(record);
  const edited = currentReceiptFor({ ...record, period: '16-18', jalaliDay: '1405-08-15', staff: 'sonia' });
  const longService = 'خدمات دست💅'.repeat(9) + ',;\\\r\nEND:VEVENT';
  const initial = receiptCalendar(original)!;
  const updated = receiptCalendar({ ...edited, service: longService })!;
  assert.ok(updated.endsWith('\r\n'));
  const lines = updated.slice(0, -2).split('\r\n');
  assert.ok(lines.every(line => Buffer.byteLength(line, 'utf8') <= 75));
  assert.ok(lines.some(line => line.startsWith(' ')));
  const unfolded = updated.replace(/\r\n /g, '');
  assert.match(initial, /DTSTART:20261105T083000Z\r\nDTEND:20261105T103000Z/);
  assert.match(unfolded, /DTSTART:20261106T123000Z\r\nDTEND:20261106T143000Z/);
  assert.match(unfolded, /DTSTAMP:20261104T090000Z/);
  assert.ok(unfolded.includes('خدمات دست💅'.repeat(9) + '\\,\\;\\\\\\nEND:VEVENT'));
  assert.equal(lines.filter(line => line === 'END:VEVENT').length, 1);
  const uid = /^UID:(.+)\r$/m;
  assert.ok(initial.match(uid)?.[1]);
  assert.equal(initial.match(uid)![1], updated.match(uid)![1]);
  assert.equal(receiptCalendar({ ...edited, status: 'CANCELLED' }), null);
  assert.equal(updated.includes(record.name), false);
});

test('each saved proof survives separate tab writes and refreshes without storing guest details', t => {
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    key(index: number) { return [...values.keys()][index] ?? null; },
  };
  const tab = () => Object.assign(new EventTarget(), { localStorage: storage });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  const openTab = () => Object.defineProperty(globalThis, 'window', { configurable: true, value: tab() });
  openTab();
  assert.equal(rememberBookingReceipt(first.reference, first.requestKey), true);
  openTab();
  assert.equal(rememberBookingReceipt(second.reference, second.requestKey), true);
  assert.equal(rememberBookingReceipt(first.reference, first.requestKey), true);
  assert.equal(rememberBookingReceipt('invalid', second.requestKey), false);
  openTab();
  assert.deepEqual(listBookingReceipts().map(({ reference, requestKey }) => ({ reference, requestKey })).sort((a, b) => a.reference.localeCompare(b.reference)), [first, second]);
  values.clear();
  assert.deepEqual(listBookingReceipts(), []);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { get localStorage() { return undefined; } }) });
  assert.equal(rememberBookingReceipt(first.reference, first.requestKey), false);
  assert.equal(listBookingReceipts()[0]?.reference, first.reference);
});

test('unavailable, mismatched, or malformed responses never restore a confirmed receipt', async t => {
  const receipt = currentReceiptFor(record);
  const signal = new AbortController().signal;
  const respond = (body: unknown, status = 200) => async () => Response.json(body, { status });
  const fetchMock = t.mock.method(globalThis, 'fetch', respond({ receipt: { ...receipt, reference: second.reference } }));
  await assert.rejects(fetchBookingReceipt(first, signal));
  fetchMock.mock.mockImplementation(respond({ receipt }, 503));
  await assert.rejects(fetchBookingReceipt(first, signal));
  fetchMock.mock.mockImplementation(respond({ receipt: { ...receipt, status: 'PENDING' } }));
  await assert.rejects(fetchBookingReceipt(first, signal));
  fetchMock.mock.mockImplementation(respond({ receipt: { ...receipt, status: 'CANCELLED' } }));
  assert.equal((await fetchBookingReceipt(first, signal)).status, 'CANCELLED');
  const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(String(url).includes(first.requestKey), false);
  assert.equal(String(url).includes(first.reference), false);
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(String(init.body)), first);
});
