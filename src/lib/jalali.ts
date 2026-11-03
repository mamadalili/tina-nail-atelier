import * as jalaali from 'jalaali-js';

export const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const faNumber = (value: number | string) => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
export const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function todayInTehran(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { timeZone: 'Asia/Tehran', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return dateKey(value('year'), value('month'), value('day'));
}

export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}

export function monthCells(year: number, month: number): Array<number | null> {
  const first = jalaali.toGregorian(year, month, 1);
  const offset = (new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay() + 1) % 7;
  const days = jalaali.jalaaliMonthLength(year, month);
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => index >= offset && index < offset + days ? index - offset + 1 : null);
}

export function toGregorianDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!jalaali.isValidJalaaliDate(year, month, day)) throw new Error('Invalid Jalali date');
  const value = jalaali.toGregorian(year, month, day);
  return `${value.gy}-${String(value.gm).padStart(2, '0')}-${String(value.gd).padStart(2, '0')}`;
}

export function isAllowedDay(key: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  try {
    const timestamp = Date.parse(toGregorianDay(key));
    const lower = Date.parse(toGregorianDay(today));
    return timestamp >= lower && timestamp <= lower + 90 * 86400000;
  } catch { return false; }
}

export function readableDay(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return `${faNumber(day)} ${months[month - 1]} ${faNumber(year)}`;
}
