import type { PrismaClient } from '../generated/prisma/client';
import { journeyId, maxJourneyMs, type MetricEvent } from '../features/booking/metric-event';

const reportDays = 30;
const hourlyStartLimit = 1000;

export async function recordBookingMetric(db: PrismaClient, event: MetricEvent, now = new Date()) {
  const { id } = event;
  if (event.event === 'start') {
    return db.$transaction(async tx => {
      // Serialize the global, address-free intake limit while allowing a retried session to finish.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('tina-booking-metrics-start'))::text`;
      await tx.bookingJourney.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - reportDays * maxJourneyMs) } } });
      const existing = await tx.bookingJourney.findUnique({ where: { id }, select: { id: true } });
      if (!existing) {
        const count = await tx.bookingJourney.count({ where: { createdAt: { gte: new Date(now.getTime() - 3600000) } } });
        if (count >= hourlyStartLimit) return false;
      }
      await tx.bookingJourney.upsert({ where: { id }, update: { started: true }, create: { id, started: true, createdAt: now } });
      return true;
    });
  }
  const where = { id, started: true, createdAt: { gte: new Date(now.getTime() - maxJourneyMs) } };
  if (event.event === 'selected') {
    await db.bookingJourney.updateMany({ where: { ...where, elapsedMs: null }, data: { elapsedMs: event.elapsedMs } });
  } else {
    await db.bookingJourney.updateMany({ where: { ...where, receiptIssued: true }, data: { receiptSeen: true } });
  }
  return true;
}

export async function issueBookingMetric(db: PrismaClient, id: string | null, now = new Date()) {
  if (!id || !journeyId.safeParse(id).success) return;
  await db.bookingJourney.upsert({ where: { id }, create: { id, createdAt: now, receiptIssued: true }, update: { receiptIssued: true } });
}
