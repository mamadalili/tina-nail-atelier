'use client';

import { useEffect, useRef, useState } from 'react';
import { dateKey, faNumber, isAllowedDay, monthCells, months, readableDay, shiftMonth } from '@/lib/jalali';
import { Icon } from '@/components/Icon';

export function JalaliCalendar({ today, selected, onSelect }: { today: string; selected: string; onSelect: (key: string) => void }) {
  const [year, initialMonth] = today.split('-').map(Number);
  const [view, setView] = useState({ year, month: initialMonth });
  useEffect(() => {
    const [currentYear, currentMonth] = today.split('-').map(Number);
    setView(current => dateKey(current.year, current.month, 1) < `${today.slice(0, 7)}-01` ? { year: currentYear, month: currentMonth } : current);
  }, [today]);
  const calendarRef = useRef<HTMLDivElement>(null);
  const monthStart = dateKey(view.year, view.month, 1);
  const nextMonth = shiftMonth(view.year, view.month, 1);
  const nextStart = dateKey(nextMonth.year, nextMonth.month, 1);
  const previousDisabled = monthStart <= `${today.slice(0, 7)}-01`;
  const nextDisabled = !isAllowedDay(nextStart, today);

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const buttons = Array.from(calendarRef.current!.querySelectorAll<HTMLButtonElement>('.calendar-day:not(:disabled)'));
    const current = buttons.indexOf(event.currentTarget);
    buttons[Math.max(0, Math.min(buttons.length - 1, current + offsets[event.key]))]?.focus();
  }

  return <div className="jalali-calendar" ref={calendarRef}>
    <div className="calendar-heading"><h4 aria-live="polite">{months[view.month - 1]} <span>{faNumber(view.year)}</span></h4><div className="calendar-navigation"><button type="button" aria-label="ماه قبل" disabled={previousDisabled} onClick={() => setView(shiftMonth(view.year, view.month, -1))}><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} size={18} /></button><button type="button" aria-label="ماه بعد" disabled={nextDisabled} onClick={() => setView(nextMonth)}><Icon name="chevron" size={18} /></button></div></div>
    <div className="calendar-week" aria-hidden="true">{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, index) => <span key={index}>{day}</span>)}</div>
    <div className="calendar-days" role="group" aria-label={`انتخاب روز از ${months[view.month - 1]} ${faNumber(view.year)}`}>{monthCells(view.year, view.month).map((day, index) => {
      if (day === null) return <span key={`empty-${index}`} />;
      const key = dateKey(view.year, view.month, day);
      return <button key={key} type="button" className={`calendar-day${key === selected ? ' selected' : ''}${key === today ? ' today' : ''}`} disabled={!isAllowedDay(key, today)} aria-label={readableDay(key)} aria-pressed={key === selected} aria-current={key === today ? 'date' : undefined} onKeyDown={moveFocus} onClick={() => onSelect(key)}>{faNumber(day)}</button>;
    })}</div>
    <div className="calendar-compact"><label htmlFor="compact-day">روز دلخواه</label><select id="compact-day" value={selected.startsWith(`${view.year}-${String(view.month).padStart(2, '0')}`) ? selected : ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>روز را انتخاب کن</option>{monthCells(view.year, view.month).filter((day): day is number => day !== null).map(day => { const key = dateKey(view.year, view.month, day); return <option key={key} value={key} disabled={!isAllowedDay(key, today)}>{readableDay(key)}</option>; })}</select></div>
    <p className="calendar-selection" aria-live="polite">{selected ? readableDay(selected) : 'روز دلخواهت را انتخاب کن.'}<span>تقویم شمسی</span></p>
  </div>;
}
