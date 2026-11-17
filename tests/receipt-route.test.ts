import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { POST } from '../src/app/api/receipt/route';
import { getDb } from '../src/server/db';
import { findGuestReceipt } from '../src/server/guest-receipts';

test('the receipt endpoint rejects cross-origin requests and reference-only lookup', async () => {
  const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : 'http://127.0.0.1:18838';
  const request = (source: string, type: string, body: string) => new Request(origin + '/api/receipt', {
    method: 'POST', headers: { Origin: source, Host: new URL(origin).host, 'Content-Type': type }, body,
  });
  const reference = 'TN-1234567890ABCDEF';
  assert.equal((await POST(request('https://foreign.invalid', 'application/json', '{}'))).status, 403);
  assert.equal((await POST(request(origin, 'text/plain', '{}'))).status, 415);
  assert.equal((await POST(request(origin, 'application/json', '('))).status, 400);
  assert.equal((await POST(request(origin, 'application/json', 'x'.repeat(8193)))).status, 413);
  const denied = await POST(request(origin, 'application/json', JSON.stringify({ reference })));
  assert.equal(denied.status, 404);
  assert.match(denied.headers.get('cache-control')!, /no-store/);
  assert.equal((await denied.text()).includes(reference), false);
});

test('a chunked receipt lookup stops reading as soon as the private proof size limit is exceeded', async () => {
  const origin = new URL(process.env.SITE_URL ?? 'http://127.0.0.1:18838').origin;
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (reads === 32768) { controller.close(); return; }
      reads++;
      controller.enqueue(new Uint8Array(256));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request(origin + '/api/receipt', {
    method: 'POST', headers: { Origin: origin, Host: new URL(origin).host, 'Content-Type': 'application/json' }, body, duplex: 'half',
  } as RequestInit);
  assert.equal(request.headers.get('content-length'), null);
  assert.equal((await POST(request)).status, 413);
  assert.equal(cancelled, true);
  assert.ok(reads <= 3, `Consumed ${reads} chunks`);
});

test('PostgreSQL matches the original proof across cancellation and reuse of the same slot', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }) });
  const proof = () => ({ reference: 'TN-' + randomUUID().replaceAll('-', '').toUpperCase(), requestKey: randomUUID() });
  const old = proof();
  const active = proof();
  const data = {
    payloadHash: 'test', name: 'مهمان آزمایشی', phone: '09000000000', service: 'manicure', staff: 'tina', note: 'آزمایش خصوصی',
    jalaliDay: '1403-10-19', preferredDay: new Date('2025-01-08T00:00:00Z'), period: '12-14',
    startsAt: new Date('2025-01-08T08:30:00Z'), endsAt: new Date('2025-01-08T10:30:00Z'),
  };
  try {
    for (const [item, status] of [[old, 'CANCELLED'], [active, 'CONFIRMED']] as const) {
      await db.appointmentRequest.create({ data: { ...data, status, idempotencyKey: item.requestKey, reference: item.reference } });
    }
    assert.equal(await findGuestReceipt(db, { ...active, requestKey: old.requestKey }), null);
    assert.equal(await findGuestReceipt(db, { ...old, requestKey: active.requestKey }), null);
    const origin = new URL(process.env.SITE_URL ?? 'http://127.0.0.1:18838').origin;
    const post = (credentials: typeof old) => POST(new Request(origin + '/api/receipt', {
      method: 'POST', headers: { Origin: origin, Host: new URL(origin).host, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
    }));
    assert.equal((await post({ ...active, requestKey: old.requestKey })).status, 404);
    const response = await post(old);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.equal((await response.json()).receipt.status, 'CANCELLED');
    const receipt = await findGuestReceipt(db, active);
    assert.equal(receipt?.status, 'CONFIRMED');
    assert.ok(!['phone', 'note', 'idempotencyKey'].some(key => key in receipt!));
    await db.appointmentRequest.update({ where: { reference: active.reference }, data: {
      staff: 'sonia', period: '16-18', name: 'مهمان جدید', startsAt: new Date('2025-01-08T12:30:00Z'), endsAt: new Date('2025-01-08T14:30:00Z'),
    } });
    const moved = await findGuestReceipt(db, active);
    assert.equal(moved?.staffName, 'سونیا');
    assert.equal(moved?.startsAt, '2025-01-08T12:30:00.000Z');
    assert.equal(moved?.name, 'مهمان جدید');
    await db.appointmentRequest.update({ where: { reference: active.reference }, data: { status: 'PENDING' } });
    assert.equal(await findGuestReceipt(db, active), null);
  } finally {
    await db.appointmentRequest.deleteMany({ where: { idempotencyKey: { in: [old.requestKey, active.requestKey] } } });
    await db.$disconnect();
    await getDb().$disconnect();
  }
});
