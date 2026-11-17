import { z } from 'zod';
import { manicureOptions, periods, services, staffMembers, type StaffId } from '../../content/salon';
import { toGregorianDay } from '../../lib/jalali';

const reference = z.string().regex(/^TN-[A-F0-9]{16,32}$/);
export const receiptProofSchema = z.object({ reference, requestKey: z.uuidv4() });
export type ReceiptProof = z.infer<typeof receiptProofSchema>;

const receiptFields = z.object({
  reference,
  status: z.literal('CONFIRMED'),
  name: z.string().min(2).max(80),
  service: z.string().min(1),
  treatment: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(periods.map(period => period.id)),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  issuedAt: z.iso.datetime(),
  version: z.int().positive().optional(),
  staff: z.enum(staffMembers.map(item => item.id)).default('tina'),
});

function withStaffName<T extends { staff: StaffId }>(data: T) {
  return { ...data, staffName: staffMembers.find(item => item.id === data.staff)!.name };
}

export const receiptSchema = receiptFields.transform(data => withStaffName(data));
export type BookingReceiptData = z.infer<typeof receiptSchema>;
export const savedReceiptSchema = receiptFields.extend({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  updatedAt: z.iso.datetime(),
}).transform(data => withStaffName(data));
export type SavedBookingReceipt = z.infer<typeof savedReceiptSchema>;

export function slotTimes(day: string, periodId: string) {
  const period = periods.find(item => item.id === periodId);
  if (!period) throw new Error('INVALID_PERIOD');
  const base = new Date(`${toGregorianDay(day)}T${String(period.startHour).padStart(2, '0')}:00:00Z`);
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', timeZoneName: 'longOffset' }).formatToParts(base).find(part => part.type === 'timeZoneName')!.value;
  const offset = zone.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!offset && zone !== 'GMT') throw new Error('INVALID_TIMEZONE_OFFSET');
  const minutes = offset ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1) : 0;
  const startsAt = new Date(base.getTime() - minutes * 60000);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600000) };
}

export type ReceiptRecord = {
  reference: string; status: string; name: string; service: string; receiptServiceName: string | null;
  manicureType: string | null; jalaliDay: string; period: string; createdAt: Date; staff?: string;
  startsAt?: Date | null; endsAt?: Date | null; version?: number;
};

const originalServiceNames = { manicure: 'خدمات مانیکور', pedicure: 'خدمات پدیکور' };

export function bookedServiceName(record: Pick<ReceiptRecord, 'service' | 'receiptServiceName'>) {
  const service = services.find(item => item.id === record.service);
  if (!service) throw new Error('INVALID_SERVICE');
  return record.receiptServiceName ?? originalServiceNames[service.id];
}

function receiptFieldsFor(record: ReceiptRecord) {
  const slot = record.startsAt && record.endsAt ? { startsAt: record.startsAt, endsAt: record.endsAt } : slotTimes(record.jalaliDay, record.period);
  return {
    reference: record.reference, status: record.status, name: record.name, service: bookedServiceName(record),
    treatment: record.service === 'manicure' ? manicureOptions.find(item => item.id === record.manicureType)?.label ?? '' : '',
    date: record.jalaliDay, period: record.period, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), issuedAt: record.createdAt.toISOString(), staff: record.staff ?? 'tina',
    ...(record.version !== undefined && { version: record.version }),
  };
}

export function receiptFor(record: ReceiptRecord): BookingReceiptData {
  if (record.status !== 'CONFIRMED') throw new Error('BOOKING_NOT_CONFIRMED');
  return receiptSchema.parse(receiptFieldsFor(record));
}

export function currentReceiptFor(record: ReceiptRecord & { updatedAt: Date }): SavedBookingReceipt {
  return savedReceiptSchema.parse({ ...receiptFieldsFor(record), updatedAt: record.updatedAt.toISOString() });
}
