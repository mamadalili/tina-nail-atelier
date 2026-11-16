import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { reserveAppointment, ReservationError } from '../src/server/reservations';
import { todayInTehran } from '../src/lib/jalali';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';

function testDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Integration test requires an isolated loopback database');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4, connectionTimeoutMillis: 5000 }) });
}

test('database arbitrates concurrent slots and idempotent retries with one outbox set', { skip: !enabled }, async () => {
  const db = testDatabase();
  const keys = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const data = { name: 'تست تراکنش', phone: '09120000000', service: 'manicure', manicureType: 'gel', date: todayInTehran(new Date(Date.now() + 30 * 86400000)), period: '12-14', note: '', consent: true };
  try {
    const results = await Promise.allSettled([
      reserveAppointment(db, keys[0], data),
      reserveAppointment(db, keys[1], { ...data, phone: '09120000001', service: 'pedicure', manicureType: '' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const loser = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.ok(loser.reason instanceof ReservationError, String(loser.reason));
    assert.equal(loser.reason.code, 'SLOT_TAKEN');
    const index = results.findIndex(result => result.status === 'fulfilled');
    const winnerData = index === 0 ? data : { ...data, phone: '09120000001', service: 'pedicure', manicureType: '' };
    const first = (results[index] as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveAppointment>>>).value;
    const replay = await reserveAppointment(db, keys[index], winnerData);
    assert.equal(replay.repeated, true);
    assert.equal(replay.receipt.reference, first.receipt.reference);
    const records = await db.appointmentRequest.findMany({ where: { idempotencyKey: { in: keys } }, include: { outbox: true } });
    assert.equal(records.length, 1);
    assert.equal(records[0].status, 'CONFIRMED');
    assert.equal(records[0].outbox.length, 3);
    assert.deepEqual(records[0].outbox.map(item => item.channel).sort(), ['SMS_ADMIN', 'SMS_USER', 'WHATSAPP_ADMIN']);
    assert.ok(records[0].outbox.every(item => item.sentAt === null));
    const { manicureType: _treatment, ...withoutTreatment } = data;
    const soniaRequest = { ...withoutTreatment, phone: '09120000002', staff: 'sonia' };
    const sonia = await reserveAppointment(db, keys[3], soniaRequest);
    assert.equal(sonia.receipt.staffName, 'سونیا');
    assert.equal(sonia.receipt.service, 'خدمات دست');
    assert.equal(sonia.receipt.treatment, '');
    const stored = await db.appointmentRequest.findUniqueOrThrow({ where: { idempotencyKey: keys[3] } });
    assert.equal(stored.manicureType, null);
    assert.equal(stored.receiptServiceName, 'خدمات دست');
    const blankReplay = await reserveAppointment(db, keys[3], { ...soniaRequest, manicureType: '' });
    assert.equal(blankReplay.repeated, true);
    assert.deepEqual(blankReplay.receipt, sonia.receipt);
    await assert.rejects(reserveAppointment(db, keys[4], { ...data, phone: '09120000003', staff: 'sonia' }), (error: unknown) => error instanceof ReservationError && error.code === 'SLOT_TAKEN');
    const legacyHash = createHash('sha256').update(JSON.stringify(winnerData)).digest('hex');
    await db.appointmentRequest.update({ where: { id: records[0].id }, data: { payloadHash: legacyHash } });
    assert.equal((await reserveAppointment(db, keys[index], winnerData)).receipt.staff, 'tina');
    await assert.rejects(reserveAppointment(db, keys[index], { ...winnerData, name: 'اطلاعات متفاوت' }), (error: unknown) => error instanceof ReservationError && error.code === 'IDEMPOTENCY_CONFLICT');
    const lateReplay = await reserveAppointment(db, keys[index], winnerData, new Date(Date.now() + 40 * 86400000));
    assert.equal(lateReplay.receipt.reference, first.receipt.reference);
    await db.appointmentRequest.update({ where: { id: records[0].id }, data: { status: 'CANCELLED' } });
    const replacement = await reserveAppointment(db, keys[2], data);
    assert.equal(replacement.receipt.status, 'CONFIRMED');
  } finally {
    await db.appointmentRequest.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await db.$disconnect();
  }
});

test('replaying historical hand and foot bookings returns the originally issued service labels', { skip: !enabled }, async () => {
  const db = testDatabase();
  const keys: string[] = [];
  try {
    const cases = [
      { service: 'manicure', manicureType: 'extensions', period: '12-14', hour: '08', name: 'خدمات مانیکور', treatment: 'کاشت' },
      { service: 'pedicure', manicureType: '', period: '14-16', hour: '10', name: 'خدمات پدیکور', treatment: '' },
    ] as const;
    for (const item of cases) {
      const key = randomUUID();
      keys.push(key);
      const input = { name: 'مهمان آزمایشی', phone: '09120000008', service: item.service, manicureType: item.manicureType, date: '1405-08-14', period: item.period, note: '', consent: true };
      // Hand predates the staff field. Foot was issued after separate staff calendars were introduced.
      const original = item.service === 'manicure' ? input : { ...input, staff: 'sonia' };
      const payloadHash = createHash('sha256').update(JSON.stringify(original)).digest('hex');
      const startsAt = new Date(`2026-11-05T${item.hour}:30:00Z`);
      const inserted = await db.appointmentRequest.create({ data: {
        reference: 'TN-' + key.replaceAll('-', '').toUpperCase(), idempotencyKey: key, payloadHash,
        name: input.name, phone: input.phone, service: item.service, manicureType: item.manicureType || null,
        staff: 'staff' in original ? String(original.staff) : 'tina',
        preferredDay: new Date('2026-11-05T00:00:00Z'), jalaliDay: input.date, period: item.period,
        status: 'CONFIRMED', startsAt, endsAt: new Date(startsAt.getTime() + 7200000),
      } });
      const replay = await reserveAppointment(db, key, original, new Date('2026-12-01T00:00:00Z'));
      assert.equal(replay.repeated, true);
      assert.equal(replay.receipt.reference, inserted.reference);
      assert.equal(replay.receipt.service, item.name);
      assert.equal(replay.receipt.treatment, item.treatment);
    }
  } finally {
    await db.appointmentRequest.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await db.$disconnect();
  }
});
