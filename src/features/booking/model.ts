import { z } from 'zod';
import { isAllowedDay, readableDay, todayInTehran } from '../../lib/jalali';
import { manicureOptions, periods, services, salon, staffMembers, type StaffId, type ManicureType, type PeriodId, type ServiceId } from '../../content/salon';

export type BookingRequest = { name: string; phone: string; service: ServiceId; manicureType: ManicureType | ''; date: string; period: PeriodId | ''; note: string; consent: boolean; staff?: StaffId };
export type ValidationResult = { success: true; data: BookingRequest } | { success: false; errors: Record<string, string> };

export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function normalizeMobile(value: string) {
  return normalizeDigits(value).replace(/[\s()-]/g, '').replace(/^(?:\+98|0098)/, '0');
}

export function validateRequest(input: unknown, today = todayInTehran()): ValidationResult {
  const schema = z.object({
    name: z.string().trim().min(2, 'نامت را کامل‌تر بنویس.').max(80, 'نام باید کوتاه‌تر از ۸۰ حرف باشد.'),
    phone: z.string().transform(normalizeMobile).refine(value => /^09\d{9}$/.test(value), 'شمارهٔ موبایل معتبر وارد کن، مثل ۰۹...'),
    service: z.enum(services.map(item => item.id), { error: 'یک خدمت انتخاب کن.' }),
    manicureType: z.enum(['', 'gel', 'extensions'], { error: 'ژلیش یا کاشت را انتخاب کن.' }).default(''),
    date: z.string().refine(value => isAllowedDay(value, today), 'یک روز معتبر از امروز تا سه ماه آینده انتخاب کن.'),
    period: z.enum(periods.map(item => item.id), { error: 'یکی از بازه‌های دوساعته را انتخاب کن.' }),
    note: z.string().trim().max(500, 'توضیحات را کوتاه‌تر از ۵۰۰ حرف بنویس.').default(''),
    consent: z.boolean().refine(value => value, 'برای هماهنگی وقت، رضایت تماس را تأیید کن.'),
    staff: z.enum(staffMembers.map(item => item.id), { error: 'تینا یا سونیا را انتخاب کن.' }).default('tina'),
  }).superRefine((data, context) => {
    if (data.service === 'manicure' && !data.manicureType) context.addIssue({ code: 'custom', path: ['manicureType'], message: 'برای مانیکور، ژلیش یا کاشت را انتخاب کن.' });
  });
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: { ...result.data, manicureType: result.data.service === 'manicure' ? result.data.manicureType : '' } };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { success: false, errors };
}

export function requestMessage(request: BookingRequest) {
  const treatment = request.service === 'manicure' ? manicureOptions.find(item => item.id === request.manicureType)?.label : '';
  return `سلام تینا، برای هماهنگی درخواست وقت پیام می‌دهم.\nنام: ${request.name}\nموبایل: ${request.phone}\nخدمت: ${services.find(item => item.id === request.service)?.name ?? request.service}${treatment ? `\nنوع مانیکور: ${treatment}` : ''}\nروز دلخواه: ${readableDay(request.date)}\nبازه: ${periods.find(item => item.id === request.period)?.label ?? request.period}${request.note ? `\nتوضیحات: ${request.note}` : ''}`;
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
  if (data.service === 'manicure' && !manicureOptions.some(item => item.id === data.manicureType)) errors.manicureType = 'برای مانیکور، ژلیش یا کاشت را انتخاب کن.';
  if (!isAllowedDay(data.date, todayInTehran(now))) errors.date = 'روز دلخواهت را از تقویم انتخاب کن.';
  if (!periods.some(item => item.id === data.period)) errors.period = 'یکی از بازه‌های دوساعته را انتخاب کن.';
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
