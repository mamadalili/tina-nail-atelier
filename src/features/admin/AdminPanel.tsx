'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { faNumber, readableDay, shiftMonth, todayInTehran } from '@/lib/jalali';
import { isUpcomingPeriod } from '@/features/booking/model';
import { manicureOptions, services } from '@/content/salon';
import { AdminCalendar } from './AdminCalendar';
import { AppointmentDialog, type EditData } from './AppointmentDialog';
import { daySlots, monthSchema, monthSummary, mutationRecovery, type Appointment, type CalendarData } from './model';
import './admin.css';

class ApiFailure extends Error { constructor(message: string, public status: number, public code = '') { super(message); } }
const endpoint = '/tina-administrator/api.php';

export function AdminPanel() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'ready' | 'error'>('checking');
  const [configured, setConfigured] = useState(false);
  const [today, setToday] = useState(() => todayInTehran());
  const [day, setDay] = useState(() => todayInTehran());
  const [view, setView] = useState(() => { const [year, month] = todayInTehran().split('-').map(Number); return { year, month }; });
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<{ appointment: Appointment; mode: 'edit' | 'cancel' } | null>(null);
  const [dialogError, setDialogError] = useState('');
  const csrf = useRef('');
  const month = `${view.year}-${String(view.month).padStart(2, '0')}`;

  const api = useCallback(async (action: string, body?: object, signal?: AbortSignal) => {
    const response = await fetch(`${endpoint}?action=${action}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current } : undefined, body: body ? JSON.stringify(body) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new ApiFailure(typeof data.message === 'string' ? data.message : 'درخواست انجام نشد؛ دوباره تلاش کن.', response.status, data.code);
    return data;
  }, []);

  const loadStatus = useCallback(async () => {
    setPhase('checking');
    try {
      const status = await api('status'); csrf.current = status.csrf; setConfigured(status.configured === true);
      if (typeof status.now === 'string') { const date = todayInTehran(new Date(status.now)); setToday(date); }
      setPhase(status.authenticated === true ? 'ready' : 'login');
    } catch { setMessage('ارتباط با پنل برقرار نشد. دوباره تلاش کن.'); setPhase('error'); }
  }, [api]);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const controller = new AbortController();setLoading(true);
    api(`month&month=${month}`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) setCalendar(monthSchema.parse(data)); }).catch(error => {
      if (controller.signal.aborted) return;
      setCalendar(null);
      setFailed(true);setMessage(error instanceof ApiFailure ? error.message : 'فهرست نوبت‌ها دریافت نشد. دوباره تلاش کن.');
      if (error instanceof ApiFailure && error.status === 401) { setCalendar(null);setDialog(null);void loadStatus(); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, loadStatus, month, phase, refresh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();if (pending) return;setPending(true);setMessage('');
    try { const status = await api('login', { password });csrf.current = status.csrf;setPhase('ready');setFailed(false); }
    catch (error) { setFailed(true);setMessage(error instanceof ApiFailure ? error.message : 'ورود انجام نشد؛ دوباره تلاش کن.'); }
    finally { setPassword('');setPending(false); }
  }
  async function logout() {
    setPending(true);
    try { await api('logout', {});setCalendar(null);setDialog(null);setMessage('');await loadStatus(); }
    catch { setFailed(true);setMessage('خروج انجام نشد؛ دوباره تلاش کن.'); }
    finally { setPending(false); }
  }
  async function mutate(action: string, body: object, success: string, targetDay?: string) {
    if (pending) return;setPending(true);setDialogError('');setMessage('');
    try {
      await api(action, body);setDialog(null);setFailed(false);setMessage(success);
      if (targetDay) { setDay(targetDay);const [year, month] = targetDay.split('-').map(Number);setView({ year, month }); }
      setRefresh(value => value + 1);
    } catch (error) {
      const text = error instanceof ApiFailure ? error.message : 'نتیجهٔ تغییر دریافت نشد؛ فهرست را تازه می‌کنم. وضعیت نوبت را بررسی کن.';
      const recovery = mutationRecovery(error instanceof ApiFailure ? error.status : undefined, error instanceof ApiFailure ? error.code : '');
      if (dialog && !recovery.closeDialog) setDialogError(text);else { setDialog(null);setFailed(true);setMessage(text); }
      if (error instanceof ApiFailure && error.status === 401) { setCalendar(null);setDialog(null);await loadStatus(); }
      if (recovery.refreshCalendar) setRefresh(value => value + 1);
    } finally { setPending(false); }
  }
  function moveMonth(delta: number) { const next = shiftMonth(view.year, view.month, delta);setView(next);setDay(`${next.year}-${String(next.month).padStart(2, '0')}-01`);setMessage(''); }
  function goToday() { const [year, month] = today.split('-').map(Number);setView({ year, month });setDay(today); }
  function open(record: Appointment, mode: 'edit' | 'cancel') { setDialogError('');setDialog({ appointment: record, mode }); }
  const current = calendar?.month === month ? calendar : null;
  const slots = current ? daySlots(day, current.appointments, current.blocks) : [];
  const cancelled = current?.appointments.filter(item => item.date === day && item.status === 'CANCELLED') ?? [];

  if (phase !== 'ready') return <main className="admin-login-shell"><section className="admin-login"><a href="/tina-preview/" className="admin-wordmark" lang="en" dir="ltr">Tina<span>.</span></a><p className="admin-eyebrow">مدیریت نوبت‌ها</p><h1>سلام تینا.</h1>{phase === 'checking' ? <p role="status">در حال باز کردن پنل…</p> : phase === 'error' ? <><p role="alert">{message}</p><button className="admin-button primary" onClick={() => void loadStatus()}>تلاش دوباره</button></> : <><p className="admin-login-intro">برای دیدن و مدیریت نوبت‌ها، رمز ورودت را بنویس.</p>{!configured && <p className="admin-feedback" role="status">رمز پنل هنوز راه‌اندازی نشده است.</p>}<form onSubmit={login}><label htmlFor="admin-password">رمز ورود<input id="admin-password" type="password" value={password} autoComplete="current-password" required disabled={pending || !configured} onChange={event => setPassword(event.target.value)} /></label>{message && <p className="admin-feedback error" role="alert">{message}</p>}<button className="admin-button primary" disabled={pending || !configured}>{pending ? 'در حال ورود…' : 'ورود به پنل'}</button></form></>}<a className="admin-back-link" href="/tina-preview/">دیدن سایت تینا</a></section></main>;

  return <div className="admin-app"><header className="admin-header"><div><a className="admin-wordmark" lang="en" dir="ltr" href="/tina-preview/">Tina<span>.</span></a><span>مدیریت نوبت‌ها</span></div><nav aria-label="ابزارهای پنل"><a href="/tina-preview/" target="_blank" rel="noopener">دیدن سایت</a><button disabled={pending} onClick={() => void logout()}>خروج</button></nav></header>
    <main className="admin-main"><div className="admin-page-title"><div><span className="admin-eyebrow">تقویم کاری تو</span><h1>نوبت‌ها، یک‌جا.</h1><p>یک روز را انتخاب کن؛ نوبت‌ها و ساعت‌های خالی همان روز را ببین.</p></div><button className="admin-button secondary" disabled={loading || pending} onClick={() => { setMessage('');setRefresh(value => value + 1); }}>{loading ? 'در حال دریافت…' : 'تازه‌کردن'}</button></div>
    {message && <p className={`admin-feedback${failed ? ' error' : ''}`} role={failed ? 'alert' : 'status'}>{message}</p>}
    <div className="admin-workspace"><aside><AdminCalendar year={view.year} month={view.month} day={day} today={today} summary={current ? monthSummary(current.appointments, current.blocks) : {}} onDay={value => { setDay(value);setMessage(''); }} onMonth={moveMonth} onToday={goToday} /><p className="admin-side-note">هر نوبت دو ساعت است. تغییرات این پنل روی ساعت‌های قابل رزرو سایت اعمال می‌شود.</p></aside>
      <section className="admin-day-panel" aria-labelledby="admin-day-title" aria-busy={loading}><header className="admin-day-heading"><div><p>{day === today ? 'امروز' : 'برنامهٔ روز'}</p><h2 id="admin-day-title">{readableDay(day)}</h2></div><span>به وقت تهران</span></header>
        {loading ? <div className="admin-loading" role="status">در حال دریافت نوبت‌های این ماه…</div> : !current ? <div className="admin-loading"><p>فهرست نوبت‌ها قابل نمایش نیست.</p><button className="admin-text-button" onClick={() => setRefresh(value => value + 1)}>دریافت دوباره</button></div> : <><div className="admin-slot-list">{slots.map(slot => <article className={`admin-slot ${slot.kind}`} key={slot.id}><div className="admin-slot-time"><strong>{slot.label}</strong><span>{slot.kind === 'appointment' ? 'نوبت ثبت‌شده' : slot.kind === 'blocked' ? 'بسته' : isUpcomingPeriod(day, slot.id) ? 'آزاد' : 'زمان گذشته'}</span></div>{slot.appointment ? <div className="admin-guest"><div className="admin-guest-heading"><h3>{slot.appointment.name}</h3><a dir="ltr" href={`tel:${slot.appointment.phone}`}>{faNumber(slot.appointment.phone)}</a></div><p>{services.find(item => item.id === slot.appointment!.service)?.name}{slot.appointment.manicureType ? ` · ${manicureOptions.find(item => item.id === slot.appointment!.manicureType)?.label}` : ''}</p>{slot.appointment.note && <p className="admin-guest-note">{slot.appointment.note}</p>}<div className="admin-slot-actions"><button className="admin-button secondary" disabled={pending} onClick={() => open(slot.appointment!, 'edit')}>ویرایش و تغییر زمان</button><button className="admin-text-button danger-text" disabled={pending} onClick={() => open(slot.appointment!, 'cancel')}>لغو نوبت</button></div></div> : <div className="admin-empty-slot"><p>{slot.kind === 'blocked' ? 'این ساعت در سایت قابل رزرو نیست.' : 'نوبتی برای این ساعت ثبت نشده است.'}</p><button className="admin-button secondary" disabled={pending || (slot.kind !== 'blocked' && !isUpcomingPeriod(day, slot.id))} onClick={() => void mutate('block', { date: day, period: slot.id, blocked: slot.kind !== 'blocked' }, slot.kind === 'blocked' ? 'ساعت دوباره قابل رزرو شد.' : 'ساعت بسته شد؛ در سایت قابل رزرو نیست.')}>{slot.kind === 'blocked' ? 'باز کردن این ساعت' : 'بستن این ساعت'}</button></div>}</article>)}</div>{cancelled.length > 0 && <details className="admin-cancelled"><summary>نوبت‌های لغوشدهٔ این روز ({faNumber(cancelled.length)})</summary>{cancelled.map(item => <div key={item.reference}><strong>{item.name}</strong><span>{faNumber(item.period.replace('-', ' تا '))} · لغوشده</span></div>)}</details>}</>}
      </section></div><p className="admin-footer-note">پیامک و اعلان خودکار فعلاً خاموش است. برای هماهنگی تغییر نوبت، با مهمان تماس بگیر.</p>
    </main>{dialog && <AppointmentDialog key={`${dialog.mode}-${dialog.appointment.reference}`} {...dialog} pending={pending} error={dialogError} onClose={() => setDialog(null)} onSave={(data: EditData) => void mutate('update', { reference: dialog.appointment.reference, version: dialog.appointment.version, data }, 'تغییرات نوبت ذخیره شد.', data.date)} onCancel={() => void mutate('cancel', { reference: dialog.appointment.reference, version: dialog.appointment.version }, 'نوبت لغو شد و ساعت آن آزاد است.')} />}
  </div>;
}
