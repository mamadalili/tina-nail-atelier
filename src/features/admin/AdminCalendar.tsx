'use client';

import { dateKey, faNumber, monthCells, months, readableDay } from '@/lib/jalali';

export function AdminCalendar({ year, month, day, today, summary, onDay, onMonth, onToday }: {
  year: number; month: number; day: string; today: string; summary: Record<string, { booked: number; blocked: number }>;
  onDay: (day: string) => void; onMonth: (delta: number) => void; onToday: () => void;
}) {
  return <section className="admin-calendar" aria-label="تقویم شمسی نوبت‌ها">
    <div className="admin-calendar-title"><h2 aria-live="polite">{months[month - 1]} <span>{faNumber(year)}</span></h2><div><button className="admin-icon" aria-label="ماه قبل" disabled={year === 1400 && month === 1} onClick={() => onMonth(-1)}>‹</button><button className="admin-icon" aria-label="ماه بعد" disabled={year === 1500 && month === 12} onClick={() => onMonth(1)}>›</button></div></div>
    <div className="admin-week" aria-hidden="true">{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((item, i) => <span key={i}>{item}</span>)}</div>
    <div className="admin-days" role="group" aria-label={`روزهای ${months[month - 1]} ${faNumber(year)}`}>{monthCells(year, month).map((value, i) => {
      if (value === null) return <span key={`empty-${i}`} />;
      const key = dateKey(year, month, value); const count = summary[key];
      return <button key={key} aria-label={`${readableDay(key)}${count?.booked ? `، ${faNumber(count.booked)} نوبت` : ''}${count?.blocked ? '، ساعت بسته دارد' : ''}`} aria-pressed={day === key} aria-current={today === key ? 'date' : undefined} className={`${day === key ? 'selected' : ''} ${today === key ? 'today' : ''}`} onClick={() => onDay(key)}><span>{faNumber(value)}</span><span className="admin-day-mark" aria-hidden="true">{count?.booked ? <i /> : count?.blocked ? <i className="is-blocked" /> : null}</span></button>;
    })}</div>
    <label className="admin-compact-day">روز موردنظر<select value={day} onChange={event => onDay(event.target.value)}>{monthCells(year, month).filter((value): value is number => value !== null).map(value => { const key = dateKey(year, month, value); return <option key={key} value={key}>{readableDay(key)}{summary[key]?.booked ? ` · ${faNumber(summary[key].booked)} نوبت` : ''}</option>; })}</select></label>
    <div className="admin-calendar-footer"><div><span><i /> نوبت ثبت‌شده</span><span><i className="is-blocked" /> ساعت بسته</span></div><button className="admin-text-button" onClick={onToday}>امروز</button></div>
  </section>;
}
