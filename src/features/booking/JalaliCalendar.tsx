'use client';

import { useEffect, useRef, useState } from 'react';
import { dateKey, faNumber, isAllowedDay, monthCells, months, readableDay, shiftMonth } from '@/lib/jalali';
import { Icon } from '@/components/Icon';

export function JalaliCalendar({ today, selected, onSelect }: { today: string; selected: string; onSelect: (key: string) => void }) {
  const activeDay = isAllowedDay(selected, today) ? selected : today;
  const [year, initialMonth] = activeDay.split('-').map(Number);
  const [view, setView] = useState({ year, month: initialMonth });
  const [cursor, setCursor] = useState('');
  useEffect(() => {
    setView({ year, month: initialMonth });
    setCursor(activeDay);
  }, [activeDay, year, initialMonth]);
  const calendarRef = useRef<HTMLDivElement>(null);
  const monthStart = dateKey(view.year, view.month, 1);
  const nextMonth = shiftMonth(view.year, view.month, 1);
  const nextStart = dateKey(nextMonth.year, nextMonth.month, 1);
  const previousDisabled = monthStart <= `${today.slice(0, 7)}-01`;
  const nextDisabled = !isAllowedDay(nextStart, today);
  const days = monthCells(view.year, view.month);
  const choices = days.flatMap(day => day === null ? [] : [dateKey(view.year, view.month, day)]).filter(key => isAllowedDay(key, today));
  const tabStop = [cursor, selected, today].find(key => choices.includes(key)) ?? choices[0];

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 };
    if (!(event.key in offsets) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const buttons = Array.from(calendarRef.current!.querySelectorAll<HTMLButtonElement>('.calendar-day:not(:disabled)'));
    const current = buttons.indexOf(event.currentTarget);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : current + offsets[event.key];
    buttons[Math.max(0, Math.min(buttons.length - 1, index))]?.focus();
  }

  return <div className="jalali-calendar" ref={calendarRef}>
    <div className="calendar-heading"><h4 aria-live="polite">{months[view.month - 1]} <span>{faNumber(view.year)}</span></h4><div className="calendar-navigation"><button type="button" aria-label="ماه قبل" disabled={previousDisabled} onClick={() => setView(shiftMonth(view.year, view.month, -1))}><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} size={18} /></button><button type="button" aria-label="ماه بعد" disabled={nextDisabled} onClick={() => setView(nextMonth)}><Icon name="chevron" size={18} /></button></div></div>
    <div className="calendar-week" aria-hidden="true">{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, index) => <span key={index}>{day}</span>)}</div>
    <div className="calendar-days" role="group" aria-label={`انتخاب روز از ${months[view.month - 1]} ${faNumber(view.year)}`}>{days.map((day, index) => {
      if (day === null) return <span key={`empty-${index}`} />;
      const key = dateKey(view.year, view.month, day);
      return <button key={key} type="button" className={`calendar-day${key === selected ? ' selected' : ''}${key === today ? ' today' : ''}`} disabled={!choices.includes(key)} tabIndex={key === tabStop ? 0 : -1} aria-label={readableDay(key)} aria-pressed={key === selected} aria-current={key === today ? 'date' : undefined} onFocus={() => setCursor(key)} onKeyDown={moveFocus} onClick={() => onSelect(key)}>{faNumber(day)}</button>;
    })}</div>
    <div className="calendar-compact"><label htmlFor="compact-day">روز دلخواه</label><select id="compact-day" value={choices.includes(selected) ? selected : ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>روز را انتخاب کن</option>{choices.map(key => <option key={key} value={key}>{readableDay(key)}</option>)}</select></div>
    <div className="calendar-key"><span><i aria-hidden="true" />امروز</span><span>تا ۹۰ روز آینده</span></div>
    <p className="calendar-selection" aria-live="polite">{selected ? readableDay(selected) : 'روز دلخواهت را انتخاب کن.'}</p>
  </div>;
}
