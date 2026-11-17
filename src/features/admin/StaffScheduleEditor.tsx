import { useEffect, useRef, useState, type FormEvent } from 'react';
import { periods, staffMembers, type PeriodId, type StaffId } from '../../content/salon';
import { readableDay } from '../../lib/jalali';
import type { AppointmentLocation } from './BookingManagement';
import { AdminDateFields } from './AdminDateFields';
import { ApiFailure, scheduleSchema, type ScheduleConflict, type StaffSchedule } from './model';

const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
type Feedback = { message: string; error?: boolean; conflicts?: ScheduleConflict[] };

export function StaffScheduleEditor({ staff, today, request, onSaved, onBooking }: {
  staff: StaffId; today: string; request: (action: string, body?: object, signal?: AbortSignal) => Promise<unknown>;
  onSaved: () => void; onBooking: (appointment: AppointmentLocation) => void;
}) {
  const [saved, setSaved] = useState<StaffSchedule | null>(null);
  const [draft, setDraft] = useState<StaffSchedule | null>(null);
  const [date, setDate] = useState(today);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'reload'>('loading');
  const [reload, setReload] = useState(0);
  const saving = useRef<AbortController | null>(null);
  const name = staffMembers.find(person => person.id === staff)!.name;

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    request(`schedule&staff=${staff}`, undefined, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      const schedule = scheduleSchema.parse(data);
      if (schedule.staff !== staff) throw new Error('SCHEDULE_MISMATCH');
      setSaved(schedule);
      setDraft(schedule);
      setStatus('ready');
      setFeedback(null);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setStatus('reload');
      setFeedback({ error: true, message: 'برنامهٔ کاری دریافت نشد. دوباره تلاش کن.' });
    });
    return () => { controller.abort(); saving.current?.abort(); };
  }, [staff, request, reload]);

  function edit(next: StaffSchedule) {
    setDraft(next);
    setFeedback(null);
  }
  function toggle(day: number, period: PeriodId, checked: boolean) {
    if (!draft) return;
    const week = draft.week.map((row, index) => index === day
      ? periods.filter(item => item.id === period ? checked : row.includes(item.id)).map(item => item.id)
      : row);
    edit({ ...draft, week });
  }
  const dirty = draft && saved && (draft.week.some((row, index) => row.join() !== saved.week[index].join()) || draft.daysOff.join() !== saved.daysOff.join());
  async function save(event: FormEvent) {
    event.preventDefault();
    if (status !== 'ready' || !draft || !dirty || saving.current) return;
    const controller = new AbortController();
    saving.current = controller;
    setStatus('saving');
    setFeedback(null);
    try {
      const data = await request('saveSchedule', draft, controller.signal);
      if (controller.signal.aborted) return;
      const schedule = scheduleSchema.parse(data);
      if (schedule.staff !== staff || schedule.version <= draft.version) throw new Error('SCHEDULE_UNCONFIRMED');
      setSaved(schedule);
      setDraft(schedule);
      setStatus('ready');
      setFeedback({ message: `برنامهٔ کاری ${name} ذخیره شد.` });
      onSaved();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiFailure && error.code === 'SCHEDULE_CONFLICT') {
        setFeedback({ error: true, message: 'این برنامه با نوبت‌های ثبت‌شده تداخل دارد. زمان‌های زیر را باز بگذار یا ابتدا نوبت مهمان را هماهنگ کن.', conflicts: error.conflicts });
        setStatus('ready');
      } else if (error instanceof ApiFailure && error.code === 'STALE_SCHEDULE') {
        setFeedback({ error: true, message: 'برنامه در جای دیگری تغییر کرده است. برای ویرایش، آخرین برنامه را دریافت کن.' });
        setStatus('reload');
      } else if (error instanceof ApiFailure && error.status < 500) {
        setFeedback({ error: true, message: error.message });
        setStatus('ready');
      } else {
        setFeedback({ error: true, message: 'نتیجهٔ ذخیره مشخص نیست. آخرین برنامه را دریافت کن و ساعت‌ها را بررسی کن.' });
        setStatus('reload');
      }
    } finally { if (saving.current === controller) saving.current = null; }
  }

  const year = Math.max(1400, Number(today.slice(0, 4)));
  const years = Array.from({ length: Math.max(1, 1501 - year) }, (_, i) => year + i);
  const dayExists = draft?.daysOff.includes(date);
  const canAdd = draft && date >= today && !dayExists && draft.daysOff.length < 366;
  return <section id="admin-schedule" className="admin-schedule" aria-labelledby="admin-schedule-heading">
    <h2 id="admin-schedule-heading">ساعت کاری و مرخصی {name}</h2>
    {status === 'loading' && <p role="status">در حال دریافت برنامهٔ کاری…</p>}
    {draft && <form onSubmit={save}>
      <fieldset disabled={status !== 'ready'} className="schedule-fields">
        <table className="schedule-week">
          <caption>ساعت‌های قابل رزرو در هر هفته</caption>
          <thead><tr><th scope="col">روز</th>{periods.map(period => <th scope="col" key={period.id}>{period.label}</th>)}</tr></thead>
          <tbody>{weekdays.map((weekday, day) => <tr key={weekday}>
            <th scope="row">{weekday}</th>
            {periods.map(period => <td key={period.id}><label>
              <input type="checkbox" aria-label={`${weekday}، ساعت ${period.label}`} checked={draft.week[day].includes(period.id)} onChange={event => toggle(day, period.id, event.target.checked)} />
            </label></td>)}
          </tr>)}</tbody>
        </table>
        <div className="schedule-leave">
          <h3>روزهای مرخصی</h3><p>در روز مرخصی، همهٔ ساعت‌های {name} بسته است.</p>
          <AdminDateFields title="تاریخ مرخصی" date={date} years={years} onChange={setDate} />
          <button type="button" className="admin-button secondary" disabled={!canAdd} onClick={() => { if (canAdd) edit({ ...draft, daysOff: [...draft.daysOff, date].sort() }); }}>افزودن روز مرخصی</button>
          {dayExists ? <p>این روز در فهرست مرخصی است.</p> : date < today ? <p>برای مرخصی، امروز یا یکی از روزهای آینده را انتخاب کن.</p>
            : draft.daysOff.length >= 366 && <p>فهرست مرخصی پر شده است. برای افزودن تاریخ جدید، یک روز را حذف کن.</p>}
          {draft.daysOff.length ? <ul>{draft.daysOff.map(day => <li key={day}><span>{readableDay(day)}</span>
            <button type="button" className="admin-text-button danger-text" aria-label={'حذف مرخصی ' + readableDay(day)} onClick={() => edit({ ...draft, daysOff: draft.daysOff.filter(item => item !== day) })}>حذف</button>
          </li>)}</ul> : <p>روز مرخصی ثبت نشده است.</p>}
        </div>
      </fieldset>
      <button className="admin-button primary" disabled={status !== 'ready' || !dirty}>{status === 'saving' ? 'در حال ذخیره…' : 'ذخیرهٔ برنامه'}</button>
    </form>}
    {feedback && <div className={'admin-feedback' + (feedback.error ? ' error' : '')} role={feedback.error ? 'alert' : 'status'}>
      <p>{feedback.message}</p>
      {Boolean(feedback.conflicts?.length) && <ul>{feedback.conflicts!.map(item => <li key={item.reference}>
        <button type="button" className="admin-text-button" onClick={() => onBooking({ ...item, staff, status: 'CONFIRMED' })}>
          {readableDay(item.date)}، ساعت {periods.find(p => p.id === item.period)!.label} · <bdi dir="ltr">{item.reference}</bdi>
        </button>
      </li>)}</ul>}
    </div>}
    {status === 'reload' && <button type="button" className="admin-text-button" onClick={() => setReload(value => value + 1)}>دریافت آخرین برنامه</button>}
  </section>;
}
