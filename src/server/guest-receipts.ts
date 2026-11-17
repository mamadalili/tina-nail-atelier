import { z } from 'zod';
import { periods } from '../content/salon';
import { currentReceiptFor, receiptProofSchema, slotTimes, type ReceiptProof } from '../features/booking/receipt-model';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { isAllowedDay, todayInTehran, toGregorianDay } from '../lib/jalali';
import { ReservationError, slotTaken } from './reservations';
import { isStaffSlotOpen } from './staff-schedules';

const receiptSelect = {
  id: true, reference: true, status: true, name: true, service: true, receiptServiceName: true, manicureType: true,
  staff: true, jalaliDay: true, period: true, createdAt: true, updatedAt: true, startsAt: true, endsAt: true, version: true,
} as const satisfies Prisma.AppointmentRequestSelect;

const version = z.int().positive();
const changeSchema = z.discriminatedUnion('action', [
  receiptProofSchema.extend({ action: z.literal('cancel'), version }).strict(),
  receiptProofSchema.extend({
    action: z.literal('reschedule'), version,
    date: z.string().refine(day => isAllowedDay(day, day)), period: z.enum(periods.map(item => item.id)),
  }).strict(),
]);

function invalidChange() {
  return new ReservationError(422, 'INVALID_REQUEST', 'اطلاعات تغییر نوبت معتبر نیست.');
}

const startedMessages = {
  BOOKING_STARTED: 'زمان این نوبت رسیده و دیگر قابل تغییر نیست.',
  TARGET_STARTED: 'ساعت انتخابی شروع شده است؛ روز یا ساعت دیگری انتخاب کن.',
};

function ensureFuture(startsAt: Date, code: keyof typeof startedMessages = 'BOOKING_STARTED') {
  if (startsAt.getTime() <= Date.now()) throw new ReservationError(409, code, startedMessages[code]);
}

export async function findGuestReceipt(db: PrismaClient, { reference, requestKey }: ReceiptProof) {
  const record = await db.appointmentRequest.findUnique({
    where: { reference, idempotencyKey: requestKey, status: { in: ['CONFIRMED', 'CANCELLED'] } },
    select: receiptSelect,
  });
  return record ? currentReceiptFor(record) : null;
}

export async function changeGuestReceipt(db: PrismaClient, proof: ReceiptProof, input: unknown) {
  try {
    return await db.$transaction(async tx => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "AppointmentRequest"
        WHERE reference = ${proof.reference} AND "idempotencyKey" = ${proof.requestKey}::uuid
          AND status IN ('CONFIRMED', 'CANCELLED') FOR UPDATE`;
      if (!locked) return null;
      const parsed = changeSchema.safeParse(input);
      if (!parsed.success) throw invalidChange();
      const change = parsed.data;
      if (change.action === 'reschedule' && process.env.BOOKING_ENABLED !== 'true') {
        throw new ReservationError(503, 'BOOKING_DISABLED', 'تغییر زمان نوبت فعلاً در دسترس نیست؛ کمی بعد دوباره تلاش کن.');
      }
      const record = await tx.appointmentRequest.findUniqueOrThrow({ where: { id: locked.id }, select: receiptSelect });
      const originalStart = record.startsAt ?? slotTimes(record.jalaliDay, record.period).startsAt;
      const alreadyApplied = change.action === 'cancel' ? record.status === 'CANCELLED'
        : record.status === 'CONFIRMED' && record.jalaliDay === change.date && record.period === change.period;
      if (alreadyApplied && change.version <= record.version) {
        // A fresh no-op requires a future slot. Retrying a committed change only reads its result.
        if (change.action === 'reschedule' && change.version === record.version) ensureFuture(originalStart);
        return currentReceiptFor(record);
      }
      if (change.version !== record.version || record.status !== 'CONFIRMED') {
        throw new ReservationError(409, 'STALE_BOOKING', 'وضعیت نوبت تغییر کرده است؛ رسید را دوباره بررسی کن.');
      }
      ensureFuture(originalStart);

      let data: Prisma.AppointmentRequestUpdateInput = { status: 'CANCELLED' };
      let targetStart: Date | undefined;
      if (change.action === 'reschedule') {
        const times = slotTimes(change.date, change.period);
        targetStart = times.startsAt;
        ensureFuture(targetStart, 'TARGET_STARTED');
        if (!isAllowedDay(change.date, todayInTehran())) throw invalidChange();
        if (!await isStaffSlotOpen(tx, record.staff, change.date, change.period)) throw slotTaken();
        data = { jalaliDay: change.date, preferredDay: new Date(toGregorianDay(change.date)), period: change.period, ...times };
      }
      // The partial unique index arbitrates moves competing with either another move or a new booking.
      const updated = await tx.appointmentRequest.update({ where: { id: record.id }, data, select: receiptSelect });
      await tx.outboxEvent.updateMany({
        where: { requestId: record.id, sentAt: null, skippedAt: null },
        data: { skippedAt: new Date() },
      });
      // A conflicting transaction may have held a lock until the start of either slot.
      ensureFuture(originalStart);
      if (targetStart) ensureFuture(targetStart, 'TARGET_STARTED');
      return currentReceiptFor(updated);
    }, { timeout: 30000 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw slotTaken();
    throw error;
  }
}
