import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { issueBookingMetric, recordBookingMetric } from '../src/server/booking-metrics';
import { POST } from '../src/app/api/booking-metrics/route';
import { todayInTehran } from '../src/lib/jalali';

test('the public metrics route accepts only bounded first-party events without guest fields', async () => {
  const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : 'http://127.0.0.1:18234';
  const request = (body: string, source = origin, contentType = 'application/json') => new Request(origin + '/api/booking-metrics', {
    method: 'POST', headers: { Origin: source, Host: new URL(origin).host, 'Content-Type': contentType }, body,
  });
  const id = randomUUID();
  const event = { id, event: 'start' };
  assert.equal((await POST(request('{}','https://foreign.invalid'))).status, 403);
  assert.equal((await POST(request('{}',origin,'text/plain'))).status, 415);
  assert.equal((await POST(request('['))).status, 400);
  assert.equal((await POST(request('x'.repeat(300)))).status, 413);
  for (const input of [null, [], { ...event, id: 'arbitrary' }, { ...event, name: 'guest' },
    { ...event, event: 'issued' }, { ...event, event: 'selected', elapsedMs: -1 },
    { ...event, event: 'selected', elapsedMs: 86400001 }, { ...event, event: 'receipt', reference: 'private' }]) {
    const response = await POST(request(JSON.stringify(input)));
    assert.equal(response.status, 422);
    assert.match(response.headers.get('Cache-Control')!, /no-store/);
    assert.equal(await response.text(), '');
  }
});

test('a real interaction starts one journey across reloads and retains its first selection', async context => {
  const entries = new Map<string, string>();
  const events: Record<string, unknown>[] = [];
  const requests: RequestInit[] = [];
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  } } });
  context.after(() => { if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window'); });
  context.mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, options: RequestInit) => {
    requests.push(options);
    events.push(JSON.parse(String(options.body)));
    return new Response(null, { status: 204 });
  });
  const clock = context.mock.method(Date, 'now', () => 1800000000000);
  const first = await import('../src/features/booking/booking-metrics');
  assert.deepEqual(first.bookingMeasurementHeaders(), {});
  first.markTimeSelected(); first.markBookingCompleted();
  assert.equal(events.length, 0);
  first.startBookingMeasurement(); first.startBookingMeasurement();
  await wait(0);
  clock.mock.mockImplementation(() => 1800000008000);
  const reloaded = await import('../src/features/booking/booking-metrics.ts?reload=' + randomUUID()) as typeof first;
  reloaded.startBookingMeasurement(); reloaded.markTimeSelected(); reloaded.markTimeSelected();
  await wait(0);
  reloaded.markBookingCompleted(); reloaded.markBookingCompleted();
  await wait(0);
  const id = events[0]?.id;
  assert.deepEqual(events, [{ id, event: 'start' }, { id, event: 'selected', elapsedMs: 8000 }, { id, event: 'receipt' }]);
  for (const options of requests) {
    assert.equal(options.method, 'POST');
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'origin');
  }
  assert.deepEqual(first.bookingMeasurementHeaders(), { 'X-Booking-Measurement': id });
  reloaded.startBookingMeasurement();
  await wait(0);
  assert.equal(events.length, 4);
  assert.notEqual(events[3].id, id);
});

test('reloading a previously received receipt retries its pending acknowledgement without creating a start', async context => {
  const id = randomUUID();
  let saved = JSON.stringify({ id, startedAt: Date.now() - 1000, firstSelection: 500, received: true, sent: 2 });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: {
    getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; },
  } } });
  context.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); });
  const messages: unknown[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, options: RequestInit) => {
    messages.push(JSON.parse(String(options.body)));
    return new Response(null, { status: 204 });
  });
  await import('../src/features/booking/booking-metrics.ts?resume=' + randomUUID());
  await wait(0);
  assert.deepEqual(messages, [{ id, event: 'receipt' }]);
  assert.equal(JSON.parse(saved).sent, 3);
});

test('PostgreSQL records the first selection and requires a confirmed reservation before a receipt', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 1 }) });
  const id = randomUUID();
  const other = randomUUID();
  try {
    await recordBookingMetric(db, { id, event: 'selected', elapsedMs: 5 });
    assert.equal(await db.bookingJourney.count({ where: { id } }), 0);
    await issueBookingMetric(db, id);
    await recordBookingMetric(db, { id, event: 'receipt' });
    assert.equal((await db.bookingJourney.findUniqueOrThrow({ where: { id } })).receiptSeen, false);
    for (const key of [id, other]) {
      await recordBookingMetric(db, { id: key, event: 'start' });
      await recordBookingMetric(db, { id: key, event: 'start' });
      await recordBookingMetric(db, { id: key, event: 'selected', elapsedMs: 18000 });
      await recordBookingMetric(db, { id: key, event: 'selected', elapsedMs: 0 });
      await recordBookingMetric(db, { id: key, event: 'receipt' });
      await recordBookingMetric(db, { id: key, event: 'receipt' });
    }
    const rows = await db.bookingJourney.findMany({ where: { id: { in: [id, other] } } });
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.started && row.elapsedMs === 18000));
    assert.deepEqual(rows.filter(row => row.receiptSeen).map(row => row.id), [id]);
  } finally {
    await db.bookingJourney.deleteMany({ where: { id: { in: [id, other] } } });
    await db.$disconnect();
  }
});

test('the standalone booking and metrics routes grant completion only to the original confirmation', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async () => {
  const database = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
  const { NextRequest } = await import('next/server');
  const { POST: confirm } = await import('../src/app/api/appointment-requests/route');
  const { getDb } = await import('../src/server/db');
  const db = getDb();
  const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : 'http://127.0.0.1:18234';
  const headers = { Origin: origin, Host: new URL(origin).host, 'Content-Type': 'application/json' };
  const key = randomUUID();
  const ids = [randomUUID(), randomUUID()];
  const data = { name: 'مهمان آزمایشی', phone: '09000000000', staff: 'sonia', service: 'pedicure',
    date: todayInTehran(new Date(Date.now() + 32 * 86400000)), period: '16-18', note: '', consent: true };
  const metric = (id: string, event: string) => POST(new Request(origin + '/api/booking-metrics', {
    method: 'POST', headers, body: JSON.stringify({ id, event }),
  }));
  try {
    for (const [index, id] of ids.entries()) {
      assert.equal((await metric(id, 'start')).status, 204);
      const response = await confirm(new NextRequest(origin + '/api/appointment-requests', {
        method: 'POST', headers: { ...headers, 'Idempotency-Key': key, 'X-Booking-Measurement': id }, body: JSON.stringify(data),
      }));
      assert.equal(response.status, index === 0 ? 201 : 200);
      assert.equal((await metric(id, 'receipt')).status, 204);
    }
    const counted = await db.bookingJourney.findMany({ where: { id: { in: ids }, receiptSeen: true }, select: { id: true } });
    assert.deepEqual(counted, [{ id: ids[0] }]);
  } finally {
    await db.bookingJourney.deleteMany({ where: { id: { in: ids } } });
    await db.appointmentRequest.deleteMany({ where: { idempotencyKey: key } });
    await db.$disconnect();
  }
});
