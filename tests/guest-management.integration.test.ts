import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, test, type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { GET as getDay } from '../src/app/api/availability/route';
import { GET as getOptions } from '../src/app/api/booking-options/route';
import { POST as postReceipt } from '../src/app/api/receipt/route';
import { addJalaliDays, todayInTehran, toGregorianDay } from '../src/lib/jalali';
import { getDb } from '../src/server/db';
import { reserveAppointment, ReservationError } from '../src/server/reservations';
import { deliverOutboxEvent } from '../src/server/notifications';

const integration = { skip: process.env.RUN_DB_INTEGRATION !== 'true' };
const origin = new URL(process.env.SITE_URL ?? 'http://127.0.0.1:18234').origin;
const day = (offset: number) => addJalaliDays(todayInTehran(), offset);
async function post(payload: unknown) {
  const response = await postReceipt(new Request(origin + '/api/receipt', {
    method: 'POST', headers: { Origin: origin, Host: new URL(origin).host, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  assert.match(response.headers.get('cache-control')!, /no-store/);
  return { status: response.status, body: await response.json() };
}

function fixtures(t: TestContext) {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
  const db = getDb();
  const keys: string[] = [];
  t.after(async () => { await db.appointmentRequest.deleteMany({ where: { idempotencyKey: { in: keys } } }); });
  async function book(date: string, period: string, staff = 'tina') {
    const key = randomUUID();
    keys.push(key);
    const input = { name: 'مهمان آزمایشی', phone: '091' + String(randomInt(100000000)).padStart(8, '0'),
      service: 'pedicure', staff, date, period, note: 'خصوصی', consent: true };
    const { receipt } = await reserveAppointment(db, key, input);
    return { input, receipt, proof: { reference: receipt.reference, requestKey: key } };
  }
  return { db, book };
}

after(async () => { if (!integration.skip) await getDb().$disconnect(); });

test('moving a receipt keeps its identity, frees its old slot and replays the original booking across days', integration, async t => {
  const { db, book } = fixtures(t);
  const original = await book(day(4), '10-12');
  const target = { date: day(6), period: '14-16' };
  const otherArtist = await book(target.date, target.period, 'sonia');
  const move = { ...original.proof, action: 'reschedule', version: 1, ...target };
  const result = await post(move);
  assert.equal(result.status, 200);
  assert.equal(result.body.receipt.date, target.date);
  assert.equal(result.body.receipt.version, 2);
  assert.equal(result.body.receipt.staff, 'tina');
  assert.equal(result.body.receipt.issuedAt, original.receipt.issuedAt);
  assert.deepEqual(await post(move), result);
  const stored = await db.appointmentRequest.findUniqueOrThrow({ where: { reference: original.proof.reference }, include: { outbox: true } });
  assert.equal(stored.jalaliDay, target.date);
  assert.equal(stored.preferredDay.toISOString().slice(0, 10), toGregorianDay(target.date));
  assert.equal(stored.startsAt?.toISOString(), toGregorianDay(target.date) + 'T10:30:00.000Z');
  assert.equal(stored.startsAt?.toISOString(), result.body.receipt.startsAt);
  assert.equal(stored.endsAt?.toISOString(), result.body.receipt.endsAt);
  assert.equal(stored.outbox.length, 3);
  assert.ok(stored.outbox.every(event => event.skippedAt && !event.sentAt));
  const replay = await reserveAppointment(db, original.proof.requestKey, original.input);
  assert.ok(replay.repeated);
  assert.equal(replay.receipt.date, target.date);
  assert.equal(replay.receipt.reference, original.proof.reference);
  await assert.rejects(reserveAppointment(db, original.proof.requestKey, { ...original.input, ...target }),
    (error: unknown) => error instanceof ReservationError && error.code === 'IDEMPOTENCY_CONFLICT');
  await book(original.input.date, original.input.period);
  await assert.rejects(book(target.date, target.period), (error: unknown) => error instanceof ReservationError && error.code === 'SLOT_TAKEN');
  assert.equal((await post(otherArtist.proof)).body.receipt.status, 'CONFIRMED');
});

test('only the matching proof can cancel, and retries preserve the cancellation after the slot is reused', integration, async t => {
  const { db, book } = fixtures(t);
  const original = await book(day(8), '12-14');
  const lookup = await post(original.proof);
  assert.equal(lookup.body.receipt.version, 1);
  const change = { ...original.proof, action: 'cancel', version: 1 };
  const denied = await post({ ...change, requestKey: randomUUID() });
  assert.equal(denied.status, 404);
  assert.deepEqual(await post({ ...change, reference: 'TN-ABCD123456789012' }), denied);
  assert.ok(!JSON.stringify(denied).includes(original.input.name));
  for (const bad of [{ version: 0 }, { version: 1.2 }, { version: '1' }, { action: 'remove' }, { staff: 'sonia' }]) {
    assert.equal((await post({ ...change, ...bad })).status, 422);
  }
  const cancelled = await post(change);
  assert.equal(cancelled.body.receipt.status, 'CANCELLED');
  assert.equal(cancelled.body.receipt.version, 2);
  assert.ok(!['phone', 'note', 'requestKey', 'idempotencyKey'].some(key => key in cancelled.body.receipt));
  const replacement = await book(original.input.date, original.input.period);
  assert.deepEqual(await post(change), cancelled);
  const stale = await post({ ...original.proof, action: 'reschedule', version: 1, date: day(9), period: '14-16' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'STALE_BOOKING');
  assert.equal((await post(replacement.proof)).body.receipt.status, 'CONFIRMED');
  await assert.rejects(reserveAppointment(db, original.proof.requestKey, original.input),
    (error: unknown) => error instanceof ReservationError && error.code === 'NOT_CONFIRMED');
});

test('pausing standalone booking prevents a guest move while preserving private lookup and cancellation', integration, async t => {
  const { book } = fixtures(t);
  const { proof, input } = await book(day(44), '14-16');
  const previous = process.env.BOOKING_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.BOOKING_ENABLED;
    else process.env.BOOKING_ENABLED = previous;
  });
  process.env.BOOKING_ENABLED = 'false';
  const move = { ...proof, action: 'reschedule', version: 1, date: day(45), period: '16-18' };
  const wrongProof = { ...proof, requestKey: randomUUID() };
  const missing = await post(wrongProof);
  assert.equal(missing.status, 404);
  assert.deepEqual(await post({ ...move, ...wrongProof }), missing);
  const paused = await post(move);
  assert.equal(paused.status, 503);
  const lookup = await post(proof);
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.receipt.version, 1);
  assert.equal(lookup.body.receipt.date, input.date);
  const cancel = await post({ ...proof, action: 'cancel', version: 1 });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.receipt.status, 'CANCELLED');
});

test('concurrent moves to one staff slot have one winner, and simultaneous edits to that receipt cannot overwrite each other', integration, async t => {
  const { book } = fixtures(t);
  const first = await book(day(11), '10-12');
  const second = await book(day(11), '12-14');
  const move = { action: 'reschedule', version: 1, date: day(12), period: '16-18' };
  const results = await Promise.all([first, second].map(({ proof }) => post({ ...proof, ...move })));
  const winner = results.findIndex(result => result.status === 200);
  assert.deepEqual(results.map(item => item.status).sort(), [200, 409]);
  assert.equal(results[1 - winner].body.code, 'SLOT_TAKEN');
  const unchanged = [first, second][1 - winner];
  assert.equal((await post(unchanged.proof)).body.receipt.period, unchanged.input.period);
  const proof = [first, second][winner].proof;
  const competing = await Promise.all(['10-12', '14-16'].map(period => post({ ...proof, ...move, version: 2, period })));
  assert.deepEqual(competing.map(item => item.status).sort(), [200, 409]);
  assert.equal(competing.find(item => item.status === 409)?.body.code, 'STALE_BOOKING');
  const current = (await post(proof)).body.receipt;
  assert.equal(current.version, 3);
  assert.equal(current.period, competing.find(item => item.status === 200)?.body.receipt.period);
});

test('a new reservation and a receipt move contend for the same slot without losing the original appointment', integration, async t => {
  const { book } = fixtures(t);
  const old = await book(day(18), '12-14');
  const target = { date: day(19), period: '16-18' };
  const [move, reservation] = await Promise.all([
    post({ ...old.proof, action: 'reschedule', version: 1, ...target }),
    book(target.date, target.period).then(() => 'CONFIRMED').catch(error => {
      assert.ok(error instanceof ReservationError);
      return error.code;
    }),
  ]);
  assert.deepEqual([move.status === 200 ? 'CONFIRMED' : move.body.code, reservation].sort(), ['CONFIRMED', 'SLOT_TAKEN']);
  const saved = (await post(old.proof)).body.receipt;
  assert.equal(saved.status, 'CONFIRMED');
  assert.equal(saved.date, move.status === 200 ? target.date : old.input.date);
});

test('two guests cannot swap their occupied slots or receive transient server errors while racing', integration, async t => {
  const { book } = fixtures(t);
  const date = day(21);
  const first = await book(date, '10-12');
  const second = await book(date, '12-14');
  const move = (proof: typeof first.proof, period: string) => post({ ...proof, action: 'reschedule', version: 1, date, period });
  const results = await Promise.all([move(first.proof, second.input.period), move(second.proof, first.input.period)]);
  assert.deepEqual(results.map(item => [item.status, item.body.code]), [[409, 'SLOT_TAKEN'], [409, 'SLOT_TAKEN']]);
});

test('the persisted start instant prevents edits to a started receipt and is returned on lookup', integration, async t => {
  const { db, book } = fixtures(t);
  const { proof } = await book(day(15), '10-12');
  const startsAt = new Date(Date.now() - 1000);
  await db.appointmentRequest.update({ where: { reference: proof.reference }, data: { startsAt, endsAt: new Date(+startsAt + 7200000) } });
  const lookup = (await post(proof)).body.receipt;
  assert.equal(lookup.startsAt, startsAt.toISOString());
  assert.equal(lookup.version, 2);
  for (const change of [{ action: 'cancel' }, { action: 'reschedule', date: day(16), period: '16-18' }]) {
    const denied = await post({ ...proof, ...change, version: lookup.version });
    assert.equal(denied.status, 409);
    assert.equal(denied.body.code, 'BOOKING_STARTED');
  }
});

test('a retry across the start time recovers its result while fresh edits and invalid targets are rejected', integration, async t => {
  const { book } = fixtures(t);
  const { proof } = await book(day(25), '14-16');
  const move = { ...proof, action: 'reschedule', version: 1, date: day(26), period: '10-12' };
  for (const [date, status, code] of [[day(-1), 409, 'TARGET_STARTED'], [day(91), 422, 'INVALID_REQUEST'], ['1405-13-01', 422, 'INVALID_REQUEST']] as const) {
    const denied = await post({ ...move, date });
    assert.deepEqual([denied.status, denied.body.code], [status, code]);
  }
  const moved = await post(move);
  assert.equal(moved.body.receipt.version, 2);
  t.mock.method(Date, 'now', () => Date.parse(moved.body.receipt.startsAt));
  assert.deepEqual(await post(move), moved);
  assert.equal((await post({ ...move, version: 2 })).body.code, 'BOOKING_STARTED');
  assert.equal((await post({ ...proof, action: 'cancel', version: 2 })).body.code, 'BOOKING_STARTED');
});

test('notification delivery holds the booking until provider acceptance and cannot send retired confirmations after an edit', integration, async t => {
  const { db, book } = fixtures(t);
  const { proof } = await book(day(23), '12-14');
  const events = await db.outboxEvent.findMany({ where: { request: { reference: proof.reference } } });
  await deliverOutboxEvent(db, events[0].id, async () => {
    await assert.rejects(db.$queryRaw`SELECT id FROM "AppointmentRequest" WHERE reference = ${proof.reference} FOR UPDATE NOWAIT`,
      /could not obtain lock|55P03/);
    return 'accepted-test-id';
  });
  assert.equal((await post({ ...proof, action: 'cancel', version: 1 })).body.receipt.status, 'CANCELLED');
  for (const event of events) {
    await deliverOutboxEvent(db, event.id, async () => assert.fail('A sent or retired confirmation reached the provider'));
  }
  const sent = await db.outboxEvent.findUniqueOrThrow({ where: { id: events[0].id } });
  assert.ok(sent.sentAt && !sent.skippedAt);
  assert.equal(sent.providerMessageId, 'accepted-test-id');
  assert.equal(await db.outboxEvent.count({ where: { requestId: sent.requestId, sentAt: null, skippedAt: { not: null } } }), 2);
});

test('public availability, quick options, booking and receipt moves honor the same artist hours and leave', integration, async t => {
  const { db, book } = fixtures(t);
  const original = await book(day(48), '16-18', 'sonia');
  const leave = day(53);
  const working = day(54);
  const previouslyBooked = await book(leave, '14-16', 'sonia');
  const week = Array.from({ length: 7 }, () => ['10-12', '12-14', '14-16', '16-18']);
  // The Saturday-first schedule restricts just the weekday of the working fixture.
  week[(new Date(toGregorianDay(working)).getUTCDay() + 1) % 7] = ['12-14', '14-16', '16-18'];
  await db.staffSchedule.create({ data: { staff: 'sonia', week, daysOff: [leave] } });
  t.after(async () => { await db.staffSchedule.delete({ where: { staff: 'sonia' } }); });
  const taken = async (date: string, staff: string) => {
    const response = await getDay(new NextRequest(origin + '/api/availability?' + new URLSearchParams({ date, staff })));
    assert.equal(response.status, 200);
    return (await response.json()).taken;
  };
  assert.deepEqual(await taken(working, 'sonia'), ['10-12']);
  assert.deepEqual(await taken(leave, 'sonia'), ['10-12', '12-14', '14-16', '16-18']);
  assert.deepEqual(await taken(leave, 'tina'), []);
  assert.equal((await post(previouslyBooked.proof)).body.receipt.status, 'CONFIRMED');
  const snapshot = await getOptions();
  assert.equal(snapshot.status, 200);
  const options: { staff: string; date: string; period: string }[] = (await snapshot.json()).taken;
  assert.equal(options.filter(slot => slot.staff === 'sonia' && slot.date === leave).length, 4);
  assert.deepEqual(options.filter(slot => slot.staff === 'sonia' && slot.date === working).map(slot => slot.period), ['10-12']);
  for (const date of [leave, working]) {
    await assert.rejects(book(date, '10-12', 'sonia'), (error: unknown) => error instanceof ReservationError && error.code === 'SLOT_TAKEN');
    const blocked = await post({ ...original.proof, action: 'reschedule', version: 1, date, period: '10-12' });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'SLOT_TAKEN');
  }
  const moved = await post({ ...original.proof, action: 'reschedule', version: 1, date: working, period: '12-14' });
  assert.equal(moved.body.receipt.date, working);
  await book(leave, '10-12', 'tina');
});
