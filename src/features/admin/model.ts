import { z } from 'zod';
import { periods, staffMembers } from '../../content/salon';
import { dateKey, monthCells } from '../../lib/jalali';

export const appointmentSchema = z.object({
  reference: z.string().regex(/^TN-[A-F0-9]{16,32}$/), status: z.enum(['CONFIRMED', 'CANCELLED']), version: z.number().int().positive(),
  name: z.string(), phone: z.string(), service: z.enum(['manicure', 'pedicure']), manicureType: z.enum(['', 'gel', 'extensions']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), period: z.enum(periods.map(item => item.id)), note: z.string(), issuedAt: z.string(), updatedAt: z.string().nullable(),
  staff: z.enum(staffMembers.map(item => item.id)).default('tina'),
});
const blockSchema = z.object({
  date: z.string(), period: z.string(), staff: z.enum(staffMembers.map(item => item.id)).optional(),
  source: z.enum(['manual', 'schedule']).optional(),
});
export const monthSchema = z.object({ month: z.string(), staff: z.enum(staffMembers.map(item => item.id)).default('tina'), appointments: z.array(appointmentSchema), blocks: z.array(blockSchema) });
export type Appointment = z.infer<typeof appointmentSchema>;
export type CalendarData = z.infer<typeof monthSchema>;
export type SlotBlock = CalendarData['blocks'][number];
export const scheduleSchema = z.object({
  staff: z.enum(staffMembers.map(item => item.id)), version: z.number().int().positive(),
  week: z.array(z.array(appointmentSchema.shape.period).max(periods.length)).length(7), daysOff: z.array(appointmentSchema.shape.date),
});
export type StaffSchedule = z.infer<typeof scheduleSchema>;
const conflictsSchema = z.array(appointmentSchema.pick({ reference: true, date: true, period: true }));
export type ScheduleConflict = z.infer<typeof conflictsSchema>[number];

export class ApiFailure extends Error {
  readonly conflicts: ScheduleConflict[];
  constructor(message: string, public status: number, public code = '', conflicts?: unknown) {
    super(message);
    this.conflicts = conflictsSchema.safeParse(conflicts).data ?? [];
  }
}

export function mutationRecovery(status?: number, code = '') {
  return { closeDialog: status === undefined || code === 'STALE_BOOKING' || code === 'BOOKING_CANCELLED', refreshCalendar: status === undefined || status === 409 };
}

export function daySlots(day: string, appointments: ReadonlyArray<Appointment>, blocks: ReadonlyArray<SlotBlock>) {
  return periods.map(period => {
    const appointment = appointments.find(item => item.date === day && item.period === period.id && item.status === 'CONFIRMED');
    const block = blocks.find(item => item.date === day && item.period === period.id);
    return { ...period, kind: appointment ? 'appointment' as const : block ? 'blocked' as const : 'free' as const, appointment, source: block && (block.source ?? 'manual') };
  });
}

export function monthSummary(appointments: ReadonlyArray<Appointment>, blocks: ReadonlyArray<SlotBlock>) {
  const result: Record<string, { booked: number; blocked: number }> = {};
  for (const appointment of appointments) if (appointment.status === 'CONFIRMED') { result[appointment.date] ??= { booked: 0, blocked: 0 }; result[appointment.date].booked++; }
  for (const block of blocks) { result[block.date] ??= { booked: 0, blocked: 0 }; result[block.date].blocked++; }
  return result;
}

export function validDateChange(day: string, part: 'year' | 'month' | 'day', value: number) {
  const [oldYear, oldMonth, oldDay] = day.split('-').map(Number);
  const year = part === 'year' ? value : oldYear;
  const month = part === 'month' ? value : oldMonth;
  const length = monthCells(year, month).filter(item => item !== null).length;
  return dateKey(year, month, Math.min(part === 'day' ? value : oldDay, length));
}
