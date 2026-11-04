import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import { selectionErrors, validateRequest, validateSubmission } from '../features/booking/model';
import { receiptFor, slotTimes } from '../features/booking/receipt-model';
import { toGregorianDay } from '../lib/jalali';

export class ReservationError extends Error {
  constructor(public status: number, public code: string, message: string, public errors?: Record<string, string>) { super(message); }
}

export async function reserveAppointment(db: PrismaClient, key: string, input: unknown, now = new Date()) {
  const previous = await db.appointmentRequest.findUnique({ where: { idempotencyKey: key } });
  const validation = previous ? validateRequest(input, previous.jalaliDay) : validateSubmission(input, now);
  if (!validation.success) throw new ReservationError(422, 'INVALID_REQUEST', 'اطلاعات نوبت را بررسی کن.', validation.errors);
  const data = validation.data;
  const payloadHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const { staff: _staff, ...legacyData } = data;
  const legacyHash = createHash('sha256').update(JSON.stringify(legacyData)).digest('hex');
  function replay(record: NonNullable<typeof previous>) {
    if (record.payloadHash !== payloadHash && !(data.staff === 'tina' && record.payloadHash === legacyHash)) throw new ReservationError(409, 'IDEMPOTENCY_CONFLICT', 'این شناسه برای اطلاعات دیگری استفاده شده؛ دوباره تلاش کن.');
    if (record.status !== 'CONFIRMED') throw new ReservationError(409, 'NOT_CONFIRMED', 'این نوبت قطعی نیست؛ برای پیگیری با تینا تماس بگیر.');
    return receiptFor(record);
  }
  if (previous) return { receipt: replay(previous), repeated: true };
  try {
    return await db.$transaction(async tx => {
      // Serialize per-phone rate checks; the unique index arbitrates the shared slot.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.phone}))::text`;
      const repeated = await tx.appointmentRequest.findUnique({ where: { idempotencyKey: key } });
      if (repeated) return { receipt: replay(repeated), repeated: true };
      const recent = await tx.appointmentRequest.count({ where: { phone: data.phone, createdAt: { gt: new Date(now.getTime() - 3600000) } } });
      if (recent >= 3) throw new ReservationError(429, 'RATE_LIMITED', 'چند نوبت با این شماره ثبت شده؛ برای پیگیری با تینا تماس بگیر.');
      const lateErrors = selectionErrors(data, new Date(Math.max(now.getTime(), Date.now())));
      if (Object.keys(lateErrors).length) throw new ReservationError(422, 'INVALID_REQUEST', 'روز و ساعت را دوباره بررسی کن.', lateErrors);
      const times = slotTimes(data.date, data.period);
      const created = await tx.appointmentRequest.create({ data: {
        reference: `TN-${randomBytes(8).toString('hex').toUpperCase()}`, idempotencyKey: key, payloadHash,
        name: data.name, phone: data.phone, service: data.service, manicureType: data.manicureType || null,
        staff: data.staff ?? 'tina',
        preferredDay: new Date(`${toGregorianDay(data.date)}T00:00:00Z`), jalaliDay: data.date, period: data.period,
        note: data.note, status: 'CONFIRMED', ...times,
        outbox: { create: ['SMS_USER', 'SMS_ADMIN', 'WHATSAPP_ADMIN'].map(channel => ({ channel, kind: 'CONFIRMED' })) },
      } });
      return { receipt: receiptFor(created), repeated: false };
    }, { timeout: 10000 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const repeated = await db.appointmentRequest.findUnique({ where: { idempotencyKey: key } });
      if (repeated) return { receipt: replay(repeated), repeated: true };
      const occupied = await db.appointmentRequest.findFirst({ where: { staff: data.staff ?? 'tina', jalaliDay: data.date, period: data.period, status: 'CONFIRMED' }, select: { id: true } });
      if (occupied) throw new ReservationError(409, 'SLOT_TAKEN', 'این بازه همین حالا رزرو شد؛ ساعت یا روز دیگری انتخاب کن.', { period: 'این بازه دیگر خالی نیست.' });
    }
    throw error;
  }
}
