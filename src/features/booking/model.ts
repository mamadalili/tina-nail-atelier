import { z } from 'zod';
import { isAllowedDay, readableDay, todayInTehran } from '../../lib/jalali';
import { manicureOptions, periods, services, salon, staffMembers, type StaffId, type ManicureType, type PeriodId, type ServiceId } from '../../content/salon';

export type BookingRequest = { name: string; phone: string; service: ServiceId; manicureType?: ManicureType | ''; date: string; period: PeriodId | ''; note: string; consent: boolean; staff?: StaffId };
export type ValidationResult = { success: true; data: Required<BookingRequest> } | { success: false; errors: Record<string, string> };

const chooseDate = 'روز مراجعه را از تقویم انتخاب کن.';
const choosePeriod = 'ساعت مراجعه را از بین بازه‌های دوساعته انتخاب کن.';

function requiredText(message: string) {
  return z.string({ error: message }).trim().min(1, message);
}

export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function normalizeMobile(value: string) {
  return normalizeDigits(value).replace(/[\s()-]/g, '').replace(/^(?:\+98|0098)/, '0');
}

export function validateRequest(input: unknown, today = todayInTehran()): ValidationResult {
  const schema = z.object({
    name: requiredText('نام و نام خانوادگی‌ات را وارد کن.').min(2, 'نامت را کامل‌تر بنویس.').max(80, 'نام باید کوتاه‌تر از ۸۰ حرف باشد.'),
    phone: requiredText('شمارهٔ موبایلت را وارد کن.').transform(normalizeMobile).refine(value => /^09\d{9}$/.test(value), 'شمارهٔ موبایل معتبر وارد کن، مثل ۰۹...'),
    service: z.enum(services.map(item => item.id), { error: 'یک خدمت انتخاب کن.' }),
    manicureType: z.enum(['', 'gel', 'extensions'], { error: 'نوع خدمت معتبر نیست.' }).default(''),
    date: z.string({ error: chooseDate }).min(1, chooseDate).refine(value => isAllowedDay(value, today), 'یک روز معتبر از امروز تا سه ماه آینده انتخاب کن.'),
    period: z.enum(periods.map(item => item.id), { error: choosePeriod }),
    note: z.string().trim().max(500, 'توضیحات را کوتاه‌تر از ۵۰۰ حرف بنویس.').default(''),
    consent: z.literal(true, { error: 'برای هماهنگی وقت، رضایت تماس را تأیید کن.' }),
    staff: z.enum(staffMembers.map(item => item.id), { error: 'تینا یا سونیا را انتخاب کن.' }).default('tina'),
  });
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: { ...result.data, manicureType: result.data.service === 'manicure' ? result.data.manicureType : '' } };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { success: false, errors };
}

export function requestMessage(request: BookingRequest, serviceName: string = services.find(item => item.id === request.service)?.name ?? request.service) {
  const treatment = request.service === 'manicure' ? manicureOptions.find(item => item.id === request.manicureType)?.label : '';
  return `سلام تینا، برای هماهنگی درخواست وقت پیام می‌دهم.\nنام: ${request.name}\nموبایل: ${request.phone}\nخدمت: ${serviceName}${treatment ? `\nنوع مانیکور: ${treatment}` : ''}\nروز دلخواه: ${readableDay(request.date)}\nبازه: ${periods.find(item => item.id === request.period)?.label ?? request.period}${request.note ? `\nتوضیحات: ${request.note}` : ''}`;
}

export function isUpcomingPeriod(day: string, period: string, now = new Date()) {
  const today = todayInTehran(now);
  const slot = periods.find(item => item.id === period);
  if (!slot || !isAllowedDay(day, today)) return false;
  if (day > today) return true;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return slot.startHour * 3600 >= value('hour') * 3600 + value('minute') * 60 + value('second');
}

export function selectionErrors(data: BookingRequest, now = new Date()) {
  const errors: Record<string, string> = {};
  if (!services.some(item => item.id === data.service)) errors.service = 'یک خدمت انتخاب کن.';
  if (data.staff !== undefined && !staffMembers.some(item => item.id === data.staff)) errors.staff = 'تینا یا سونیا را انتخاب کن.';
  if (!isAllowedDay(data.date, todayInTehran(now))) errors.date = chooseDate;
  if (!periods.some(item => item.id === data.period)) errors.period = choosePeriod;
  else if (data.date && !errors.date && !isUpcomingPeriod(data.date, data.period, now)) errors.period = 'این بازه شروع شده است؛ بازه یا روز دیگری انتخاب کن.';
  return errors;
}

export function validateSubmission(input: unknown, now = new Date()) {
  const result = validateRequest(input, todayInTehran(now));
  if (!result.success) return result;
  const errors = selectionErrors(result.data, now);
  return Object.keys(errors).length ? { success: false as const, errors } : result;
}

export function whatsappRequestUrl(request: BookingRequest) {
  return `${salon.whatsapp}?text=${encodeURIComponent(requestMessage(request))}`;
}
