import { useEffect, useRef, useState, type FormEvent } from 'react';
import { periods, type PeriodId } from '../../content/salon';
import { readableDay } from '../../lib/jalali';
import { sameTime } from './booking-options';
import { isUpcomingPeriod } from './model';
import type { ReceiptChange } from './receipt-access';
import type { BookingReceiptData, SavedBookingReceipt } from './receipt-model';
import { useBookingTimes } from './use-booking-times';

export function ReceiptEditor({ mode, receipt, pending, onClose, onChange }: {
  mode: ReceiptChange['action']; receipt: BookingReceiptData | SavedBookingReceipt; pending: boolean;
  onClose: () => void; onChange: (change: ReceiptChange) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [day, setDay] = useState('');
  const [period, setPeriod] = useState<PeriodId | ''>('');
  const { open, status, now, refresh } = useBookingTimes(mode === 'reschedule', receipt.issuedAt);
  const choices = open[receipt.staff].filter(slot => !sameTime(slot, receipt));
  const dates = [...new Set(choices.map(slot => slot.date))];
  const times = choices.filter(slot => slot.date === day);
  const chosen = times.find(slot => slot.period === period);
  const oldTime = periods.find(item => item.id === receipt.period)!.label;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === 'cancel') { onChange({ action: 'cancel' }); return; }
    if (!chosen || status !== 'ready') return;
    if (!isUpcomingPeriod(chosen.date, chosen.period, now())) { void refresh(); return; }
    onChange({ action: 'reschedule', date: chosen.date, period: chosen.period });
  }

  return <form className="receipt-editor" onSubmit={submit} aria-labelledby="receipt-editor-heading" aria-busy={pending}>
    <h4 id="receipt-editor-heading" ref={heading} tabIndex={-1}>{mode === 'cancel' ? 'نوبتت لغو شود؟' : 'انتخاب زمان جدید'}</h4>
    {mode === 'cancel' ? <p>با تأیید تو، نوبت {readableDay(receipt.date)}، ساعت {oldTime} با {receipt.staffName} لغو می‌شود.</p> : <>
      <p>برای {receipt.service} با {receipt.staffName} یک وقت آزاد انتخاب کن. تا ثبت زمان جدید، نوبت فعلی‌ات برقرار است.</p>
      {status === 'loading' ? <p role="status">در حال دریافت وقت‌های آزاد…</p> : status !== 'ready' ? <div>
        <p role="alert">وقت‌های آزاد دریافت نشد.</p><button type="button" className="text-button" onClick={() => void refresh()}>دریافت دوبارهٔ وقت‌ها</button>
      </div> : !dates.length ? <p role="status">تا ۹۰ روز آینده وقت آزاد دیگری برای {receipt.staffName} پیدا نشد.</p> : <fieldset className="receipt-new-time" disabled={pending}>
        <label>روز جدید<select value={dates.includes(day) ? day : ''} onChange={event => { setDay(event.target.value); setPeriod(''); }}>
          <option value="" disabled>روز را انتخاب کن</option>{dates.map(date => <option key={date} value={date}>{readableDay(date)}</option>)}
        </select></label>
        <label>ساعت جدید<select disabled={!times.length} value={chosen?.period ?? ''} onChange={event => setPeriod(event.target.value as PeriodId)}>
          <option value="" disabled>ساعت را انتخاب کن</option>{times.map(slot => <option key={slot.period} value={slot.period}>{periods.find(item => item.id === slot.period)!.label}</option>)}
        </select></label>
        {period && !chosen && <p role="status">ساعت انتخابی دیگر آزاد نیست. یک زمان دیگر انتخاب کن.</p>}
      </fieldset>}
    </>}
    <div className="receipt-editor-actions">
      <button type="submit" className={'button ' + (mode === 'cancel' ? 'receipt-danger' : 'primary')} disabled={pending || (mode === 'reschedule' && !chosen)}>
        {pending ? 'در حال ثبت…' : mode === 'cancel' ? 'بله، نوبتم را لغو کن' : 'ثبت زمان جدید'}
      </button>
      <button type="button" className="text-button" disabled={pending} onClick={onClose}>بازگشت به رسید</button>
    </div>
  </form>;
}
