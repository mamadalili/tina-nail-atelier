import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { validateRequest } from '../src/features/booking/model';
import { test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { reserveAppointment, ReservationError } from '../src/server/reservations';
import { todayInTehran } from '../src/lib/jalali';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';

test('database arbitrates concurrent slots and idempotent retries with one outbox set', { skip: !enabled }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Integration test requires an isolated loopback database');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4, connectionTimeoutMillis: 5000 }) });
  const keys = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const data = { name: 'تست تراکنش', phone: '09120000000', service: 'manicure', manicureType: 'gel', date: todayInTehran(new Date(Date.now() + 30 * 86400000)), period: '12-14', note: '', consent: true };
  try {
    const results = await Promise.allSettled([
      reserveAppointment(db, keys[0], data),
      reserveAppointment(db, keys[1], { ...data, phone: '09120000001', service: 'pedicure', manicureType: '' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const loser = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.ok(loser.reason instanceof ReservationError);
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
    const sonia = await reserveAppointment(db, keys[3], { ...data, phone: '09120000002', staff: 'sonia' });
    assert.equal(sonia.receipt.staffName, 'سونیا');
    await assert.rejects(reserveAppointment(db, keys[4], { ...data, phone: '09120000003', staff: 'sonia' }), (error: unknown) => error instanceof ReservationError && error.code === 'SLOT_TAKEN');
    const parsed = validateRequest(winnerData, data.date);
    assert.ok(parsed.success);
    const { staff: _staff, ...legacy } = parsed.data;
    await db.appointmentRequest.update({ where: { id: records[0].id }, data: { payloadHash: createHash('sha256').update(JSON.stringify(legacy)).digest('hex') } });
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
