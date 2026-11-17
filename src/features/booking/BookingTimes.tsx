'use client';

import { useRef } from 'react';
import { Icon } from '@/components/Icon';
import { periods, staffMembers, type PeriodId, type StaffId } from '@/content/salon';
import { faNumber, isAllowedDay, nextJalaliDay, readableDay } from '@/lib/jalali';
import { conflictAlternatives, sameTime, type BookingSlot, type OpenTimes } from './booking-options';
import { isUpcomingPeriod, type BookingRequest } from './model';
import { JalaliCalendar } from './JalaliCalendar';
import { StaffSelector } from './StaffSelector';
import type { AvailabilityStatus } from './use-booking-times';
import './booking-times.css';

type TimesProps = {
  open: OpenTimes;
  status: AvailabilityStatus;
  select: (slot: BookingSlot) => void;
  retry: () => void;
};
function timeLabel(period: PeriodId) { return periods.find(option => option.id === period)!.label; }
function staffName(staff: StaffId) { return staffMembers.find(person => person.id === staff)!.name; }

export function QuickTimes({ open, status, select, retry, data, today }: TimesProps & { data: BookingRequest; today: string }) {
  return <fieldset className="quick-times" aria-busy={status === 'loading'}>
    <legend>اولین وقت آزاد</legend>
    <div className="quick-times-grid">{staffMembers.map(person => {
      const slot = open[person.id][0];
      const selected = Boolean(slot && data.staff === slot.staff && sameTime(data, slot));
      const day = slot && readableDay(slot.date);
      return <button type="button" key={person.id} className="quick-time"
        disabled={!slot || status !== 'ready'} aria-pressed={selected}
        aria-label={slot ? `اولین وقت آزاد با ${person.name}، ${day}، ساعت ${timeLabel(slot.period)}` : undefined}
        onClick={() => slot && select(slot)}>
        <span className="quick-person"><strong>{person.name}</strong><span aria-hidden="true">{selected ? <Icon name="check" size={17} /> : <Icon name="arrow" size={17} />}</span></span>
        {slot ? <><span>{slot.date === today ? 'امروز، ' : ''}{day}</span><span className="quick-hour">ساعت {timeLabel(slot.period)}</span></>
          : <span>{status === 'loading' ? 'در حال بررسی…' : status === 'ready' ? 'وقت آزاد ندارد' : 'ساعت‌ها در دسترس نیست'}</span>}
      </button>;
    })}</div>
    {status === 'error' && <button type="button" className="text-button" onClick={retry}>بررسی دوبارهٔ وقت‌های آزاد</button>}
  </fieldset>;
}

export function ConflictTimes({ requested, open, status, select, retry, manual }: TimesProps & { requested: BookingSlot; manual: () => void }) {
  const { nearest, otherStaff } = conflictAlternatives(requested, open);
  return <section className="conflict-times" aria-labelledby="conflict-heading">
    <h4 id="conflict-heading" tabIndex={-1}>این وقت دیگر آزاد نیست.</h4>
    <p>{readableDay(requested.date)}، ساعت {timeLabel(requested.period)} با {staffName(requested.staff)}</p>
    {status === 'ready' ? <>
      {(nearest || otherStaff) && <p role="status">یک وقت جایگزین انتخاب کن.</p>}
      <div className="conflict-options">
        {nearest && <button type="button" onClick={() => select(nearest)}><strong>نزدیک‌ترین وقت با {staffName(nearest.staff)}</strong><span>{readableDay(nearest.date)}، ساعت {timeLabel(nearest.period)}</span></button>}
        {otherStaff && <button type="button" onClick={() => select(otherStaff)}><strong>همان ساعت با {staffName(otherStaff.staff)}</strong><span>{readableDay(otherStaff.date)}، ساعت {timeLabel(otherStaff.period)}</span></button>}
      </div>
      {!nearest && !otherStaff && <p role="status">وقت جایگزینی برای این انتخاب پیدا نشد.</p>}
    </> : status === 'loading' ? <p role="status">در حال بررسی وقت‌های جایگزین…</p> : <>
      <p role="status">دریافت وقت‌های جایگزین انجام نشد.</p><button type="button" className="text-button" onClick={retry}>بررسی دوبارهٔ وقت‌های جایگزین</button>
    </>}
    <button type="button" className="text-button" onClick={manual}>انتخاب روز و ساعت از تقویم</button>
  </section>;
}

export function ManualTimes({ data, errors, today, clock, open, status, selectStaff, selectDay, selectPeriod, retry }: {
  data: BookingRequest; errors: Record<string, string>; today: string; clock: Date; open: OpenTimes; status: AvailabilityStatus;
  selectStaff: (staff: StaffId) => void; selectDay: (day: string) => void; selectPeriod: (period: PeriodId) => void; retry: () => void;
}) {
  const datePanel = useRef<HTMLDivElement>(null);
  const periodPanel = useRef<HTMLFieldSetElement>(null);
  const staff = data.staff ?? 'tina';
  const validDay = isAllowedDay(data.date, today);
  const ready = status === 'ready' && validDay;
  const free = open[staff].filter(slot => slot.date === data.date);
  const full = ready && !free.length;
  const next = full ? nextJalaliDay(data.date) : '';
  const tomorrowAllowed = next && isAllowedDay(next, today);
  let hint = 'برای دیدن ساعت‌های آزاد، یک روز انتخاب کن.';
  if (data.date) {
    if (status === 'error' || status === 'offline') hint = 'دریافت ساعت‌ها انجام نشد.';
    else if (!validDay) hint = 'یک روز تازه از تقویم انتخاب کن.';
    else if (!ready) hint = 'در حال بررسی ساعت‌های خالی…';
    else hint = full ? 'برای این روز ساعت آزادی باقی نمانده.' : `${faNumber(free.length)} بازهٔ آزاد برای ${staffName(staff)}`;
  }

  return <div className="booking-selection manual-selection">
    <StaffSelector value={staff} onChange={selectStaff} error={errors.staff} />
    <div ref={datePanel} className="date-panel" role="group" tabIndex={-1} aria-labelledby="visit-day-title" aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-error' : undefined}>
      <h4 id="visit-day-title" className="selection-label">روز مراجعه</h4>
      {errors.date && <p className="field-error" id="date-error">{errors.date}</p>}
      <JalaliCalendar today={today} selected={data.date} onSelect={selectDay} />
    </div>
    <fieldset ref={periodPanel} className="period-choice" tabIndex={-1} aria-invalid={Boolean(errors.period)} aria-describedby={errors.period ? 'period-error' : 'period-hint'}>
      <legend>ساعت مراجعه <span className="duration-note">۲ ساعت</span></legend>
      {errors.period && <p className="field-error" id="period-error">{errors.period}</p>}
      <p id="period-hint" className="time-hint" role="status">{hint}</p>
      {ready && <div className="time-grid">{periods.map(period => {
        const available = free.some(slot => slot.period === period.id);
        const unavailable = available ? '' : isUpcomingPeriod(data.date, period.id, clock) ? 'در دسترس نیست' : 'شروع شده';
        return <label className={available && data.period === period.id ? 'choice time-choice selected' : 'choice time-choice'} key={period.id}>
          <input type="radio" name="period" value={period.id} aria-label={`ساعت ${period.label}${unavailable ? `، ${unavailable}` : ''}`} checked={available && data.period === period.id} disabled={!available} onChange={() => selectPeriod(period.id)} />
          <span>{period.label}{unavailable && <small>{unavailable}</small>}</span><Icon name="check" size={17} />
        </label>;
      })}</div>}
      {status === 'error' && <button type="button" className="text-button" onClick={retry}>بررسی دوبارهٔ ساعت‌ها</button>}
      {full && <button type="button" className="text-button" onClick={() => {
        if (tomorrowAllowed) { periodPanel.current?.focus({ preventScroll: true }); selectDay(next); }
        else { datePanel.current?.focus({ preventScroll: true }); datePanel.current?.scrollIntoView({ block: 'start' }); }
      }}>{tomorrowAllowed ? 'بررسی روز بعد' : 'انتخاب روز دیگر'}</button>}
    </fieldset>
  </div>;
}
