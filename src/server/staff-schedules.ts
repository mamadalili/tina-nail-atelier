import { z } from 'zod';
import { periods } from '../content/salon';
import type { Prisma, PrismaClient, StaffSchedule } from '../generated/prisma/client';
import { nextJalaliDay, toGregorianDay } from '../lib/jalali';

const periodIds = periods.map(period => period.id);
const weekSchema = z.array(z.array(z.enum(periodIds))).length(7);

function scheduleFor(row: StaffSchedule) {
  return { week: weekSchema.parse(row.week), daysOff: new Set(row.daysOff) };
}

function openPeriods(schedule: ReturnType<typeof scheduleFor> | undefined, day: string) {
  if (!schedule) return periodIds;
  if (schedule.daysOff.has(day)) return [];
  const weekday = (new Date(toGregorianDay(day)).getUTCDay() + 1) % 7;
  return schedule.week[weekday];
}

export async function isStaffSlotOpen(tx: Prisma.TransactionClient, staff: string, day: string, period: string) {
  // SHARE also protects the default hours when this artist has no row yet.
  // Bookings can check in parallel. Schedule inserts, edits and removals wait for them to commit.
  await tx.$executeRaw`LOCK TABLE "StaffSchedule" IN SHARE MODE`;
  const row = await tx.staffSchedule.findUnique({ where: { staff } });
  if (!openPeriods(row ? scheduleFor(row) : undefined, day).some(id => id === period)) return false;
  // Reject occupied targets before attempting a write, including two guests trying to swap slots.
  // The unique index still arbitrates contenders that both find the same vacant slot.
  const occupied = await tx.appointmentRequest.findFirst({
    where: { staff, jalaliDay: day, period, status: 'CONFIRMED' }, select: { id: true },
  });
  return occupied === null;
}

export async function unavailableSlots(db: PrismaClient, from: string, through: string, staff: string[]) {
  const [appointments, scheduleRows] = await db.$transaction([
    db.appointmentRequest.findMany({
      where: { status: 'CONFIRMED', jalaliDay: { gte: from, lte: through }, staff: { in: staff }, period: { in: periodIds } },
      select: { staff: true, jalaliDay: true, period: true },
    }),
    db.staffSchedule.findMany({ where: { staff: { in: staff } } }),
  ], { isolationLevel: 'RepeatableRead' });
  const booked = new Set(appointments.map(row => `${row.staff}/${row.jalaliDay}/${row.period}`));
  const schedules = new Map(scheduleRows.map(row => [row.staff, scheduleFor(row)]));
  const taken = [];
  for (let date = from; date <= through; date = nextJalaliDay(date)) {
    for (const artist of staff) {
      const open = openPeriods(schedules.get(artist), date);
      for (const period of periodIds) {
        if (!open.includes(period) || booked.has(`${artist}/${date}/${period}`)) taken.push({ staff: artist, date, period });
      }
    }
  }
  return taken;
}
