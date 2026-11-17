'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { periods, staffMembers } from '@/content/salon';
import { normalizeDigits } from '@/features/booking/model';
import { readableDay } from '@/lib/jalali';
import { appointmentSchema } from './model';

type RequestPanel = (action: string, body?: object, signal?: AbortSignal) => Promise<unknown>;
const locationSchema = appointmentSchema.pick({ reference: true, staff: true, date: true, period: true, status: true });
export type AppointmentLocation = z.infer<typeof locationSchema>;
const reportSchema = z.object({
  days: z.number().int().positive(), starts: z.number().int().nonnegative(),
  selections: z.number().int().nonnegative(), receipts: z.number().int().nonnegative(), medianMs: z.number().nonnegative().nullable(),
});
const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export function ReferenceSearch({ request, onFound }: { request: RequestPanel; onFound: (appointment: AppointmentLocation) => void }) {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [found, setFound] = useState<AppointmentLocation | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = normalizeDigits(reference.trim()).toUpperCase();
    setError('');
    setFound(null);
    if (!appointmentSchema.shape.reference.safeParse(value).success) {
      setInvalid(true);
      setError(value ? 'کد پیگیری کامل روی رسید را وارد کن.' : 'کد پیگیری روی رسید را وارد کن.');
      input.current?.focus();
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setInvalid(false);
    setBusy(true);
    try {
      const response = await request('search', { reference: value }, active.signal);
      if (active.signal.aborted) return;
      const { appointment } = z.object({ appointment: locationSchema }).parse(response);
      setFound(appointment);
      onFound(appointment);
    } catch (error) {
      if (!active.signal.aborted) setError(error instanceof Error && 'status' in error ? error.message : 'جست‌وجو انجام نشد. دوباره تلاش کن.');
    } finally { if (!active.signal.aborted) setBusy(false); }
  }

  return <form role="search" aria-label="جست‌وجوی نوبت" className="admin-reference-search" onSubmit={search} noValidate>
    <label htmlFor="search-booking-reference">جست‌وجو با کد پیگیری</label>
    <div className="admin-search-controls">
      <input id="search-booking-reference" ref={input} type="text" dir="ltr" autoComplete="off" autoCapitalize="characters" spellCheck={false}
        placeholder="TN-…" maxLength={65} readOnly={busy} value={reference} aria-invalid={invalid} aria-describedby={error ? 'admin-search-error' : undefined}
        onChange={event => { setReference(event.target.value); setInvalid(false); setError(''); setFound(null); }} />
      <button className="admin-button secondary" disabled={busy}>{busy ? 'در حال جست‌وجو…' : 'پیدا کردن نوبت'}</button>
    </div>
    {error && <p id="admin-search-error" role="alert">{error}</p>}
    {found && <p role="status">{found.status === 'CANCELLED' ? 'نوبت لغوشده' : 'نوبت ثبت‌شده'} در تقویم {staffMembers.find(item => item.id === found.staff)?.name}، {readableDay(found.date)}، ساعت {periods.find(item => item.id === found.period)?.label}</p>}
  </form>;
}

export function BookingPerformance({ request, refresh }: { request: RequestPanel; refresh: number }) {
  const [period, setPeriod] = useState('month');
  const [retry, setRetry] = useState(0);
  const [report, setReport] = useState<z.infer<typeof reportSchema> | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const active = new AbortController();
    setState('loading');
    request('metrics&period=' + period, undefined, active.signal).then(value => {
      if (!active.signal.aborted) { setReport(reportSchema.parse(value)); setState('ready'); }
    }).catch(() => { if (!active.signal.aborted) setState('error'); });
    return () => active.abort();
  }, [request, refresh, period, retry]);
  return <section className="admin-performance" aria-labelledby="admin-performance-heading">
    <header><div><h2 id="admin-performance-heading">آمار فرم رزرو</h2><p>برای هر دو تقویم</p></div>
      <button className="admin-text-button" disabled={state === 'loading'} onClick={() => setRetry(value => value + 1)}>تازه‌کردن آمار</button></header>
    <label className="admin-report-period">بازهٔ آمار<select value={period} onChange={event => setPeriod(event.target.value)}>
      <option value="month">۳۰ روز اخیر</option><option value="week">۷ روز اخیر</option><option value="previous-week">۷ روز پیش از آن</option>
    </select></label>
    {state === 'loading' ? <p role="status">در حال دریافت آمار…</p> : state === 'error' || !report ? <p role="alert">آمار دریافت نشد. دوباره تلاش کن.</p>
      : report.starts === 0 ? <p>هنوز شروع فرمی در این بازه ثبت نشده است. آمار از زمان انتشار این نسخه جمع‌آوری می‌شود.</p> : <>
        <dl>
          <div><dt>شروع فرم</dt><dd>{number.format(report.starts)}</dd></div>
          <div><dt>انتخاب وقت</dt><dd>{number.format(report.selections)}</dd></div>
          <div><dt>دریافت رسید</dt><dd>{number.format(report.receipts)}</dd></div>
          <div><dt>میانهٔ زمان تا انتخاب وقت</dt><dd>{report.medianMs === null ? 'هنوز انتخابی ثبت نشده' : number.format(report.medianMs / 1000) + ' ثانیه'}</dd></div>
          <div><dt>درصد شروع‌ها با دریافت رسید</dt><dd>{number.format(100 * report.receipts / report.starts)}٪</dd></div>
        </dl>
      </>}
  </section>;
}
