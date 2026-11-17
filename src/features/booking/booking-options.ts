import { z } from 'zod';
import { periods, staffMembers, type PeriodId, type StaffId } from '../../content/salon';
import { addJalaliDays, isAllowedDay, nextJalaliDay, todayInTehran } from '../../lib/jalali';
import { isUpcomingPeriod } from './model';
import { slotTimes } from './receipt-model';

export type BookingSlot = { staff: StaffId; date: string; period: PeriodId };
export type OpenTimes = Record<StaffId, BookingSlot[]>;

const snapshotSchema = z.object({
  asOf: z.iso.datetime(),
  taken: z.array(z.object({
    staff: z.enum(staffMembers.map(person => person.id)),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period: z.enum(periods.map(period => period.id)),
  })).max(91 * periods.length * staffMembers.length),
});

export function bookingWindow(now: Date) {
  const today = todayInTehran(now);
  return { today, through: addJalaliDays(today, 90) };
}

export function parseBookingSnapshot(input: unknown) {
  const { asOf, taken } = snapshotSchema.parse(input);
  const clock = new Date(asOf);
  const { today, through } = bookingWindow(clock);
  const occupied = new Set<string>();
  for (const slot of taken) {
    if (!isAllowedDay(slot.date, today)) throw new Error('INVALID_AVAILABILITY_DAY');
    occupied.add(`${slot.staff}/${slot.date}/${slot.period}`);
  }
  return { clock, today, through, occupied };
}

export function availableTimes(snapshot: ReturnType<typeof parseBookingSnapshot>, now: Date): OpenTimes {
  const open: OpenTimes = { tina: [], sonia: [] };
  // A new Tehran day also changes which 91 days the snapshot covers.
  if (todayInTehran(now) !== snapshot.today) return open;
  const todayPeriods = periods.filter(period => isUpcomingPeriod(snapshot.today, period.id, now));
  for (let date = snapshot.today; date <= snapshot.through; date = nextJalaliDay(date)) {
    for (const period of date === snapshot.today ? todayPeriods : periods) {
      for (const { id: staff } of staffMembers) {
        if (!snapshot.occupied.has(`${staff}/${date}/${period.id}`)) open[staff].push({ staff, date, period: period.id });
      }
    }
  }
  return open;
}

export function sameTime(a: { date: string; period: string }, b: { date: string; period: string }) {
  return a.date === b.date && a.period === b.period;
}

export function conflictAlternatives(requested: BookingSlot, open: OpenTimes) {
  // The lists are chronological. Only the free times immediately before and after can be nearest.
  let before: BookingSlot | null = null;
  let after: BookingSlot | null = null;
  for (const slot of open[requested.staff]) {
    if (sameTime(slot, requested)) continue;
    if (slot.date > requested.date || (slot.date === requested.date && slot.period > requested.period)) {
      after = slot;
      break;
    }
    before = slot;
  }
  let nearest = after ?? before;
  if (before && after) {
    const start = slotTimes(requested.date, requested.period).startsAt.getTime();
    if (start - slotTimes(before.date, before.period).startsAt.getTime() < slotTimes(after.date, after.period).startsAt.getTime() - start) nearest = before;
  }
  const other = staffMembers.find(person => person.id !== requested.staff)!;
  const otherStaff = open[other.id].find(slot => sameTime(slot, requested)) ?? null;
  return { nearest, otherStaff };
}
