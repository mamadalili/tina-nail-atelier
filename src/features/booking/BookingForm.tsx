'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { periods, services, salon, staffMembers, type ServiceId } from '@/content/salon';
import { StaffSelector } from './StaffSelector';
import { faNumber, isAllowedDay, nextJalaliDay, readableDay, todayInTehran } from '@/lib/jalali';
import { isUpcomingPeriod, selectionErrors, validateSubmission, type BookingRequest } from './model';
import { JalaliCalendar } from './JalaliCalendar';
import { BookingReceipt } from './BookingReceipt';
import { receiptSchema, type BookingReceiptData } from './receipt-model';
import { bookingApi, bookingFailureErrors } from './transport';

export function BookingForm({ today, initialNow, serverEnabled }: { today: string; initialNow: string; serverEnabled: boolean }) {
  const [step, setStep] = useState(0);
  const [currentToday, setCurrentToday] = useState(today);
  const [clockNow, setClockNow] = useState(() => new Date(initialNow));
  const [data, setData] = useState<BookingRequest>({ name: '', phone: '', service: 'manicure', date: '', period: '', note: '', consent: false, staff: 'tina' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<BookingReceiptData | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [availability, setAvailability] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const token = useRef<string | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const datePanel = useRef<HTMLDivElement>(null);
  const periodPanel = useRef<HTMLFieldSetElement>(null);
  const previousStep = useRef(0);
  const focusInvalid = useRef(false);

  useEffect(() => {
    const stepChanged = previousStep.current !== step;
    previousStep.current = step;
    if (!stepChanged && !focusInvalid.current) return;
    const heading = formHeading.current;
    const form = heading?.closest('form');
    const target = focusInvalid.current
      ? form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>('.form-validation')
      : heading;
    focusInvalid.current = false;
    if (target) {
      target.focus({ preventScroll: true });
      const block = target.matches('input, textarea, select') ? 'center' : 'start';
      target.scrollIntoView({ block, behavior: 'instant' });
    }
  }, [errors, step]);

  useEffect(() => {
    const select = (event: Event) => { if (pending || receipt) return; const service = (event as CustomEvent).detail as ServiceId; if (services.some(item => item.id === service)) { setData(current => ({ ...current, service })); setErrors({}); token.current = null; setStep(0); } };
    window.addEventListener('select-service', select);
    return () => window.removeEventListener('select-service', select);
  }, [pending, receipt]);

  useEffect(() => {
    setTaken([]);
    if (!data.date || !serverEnabled || receipt) { setAvailability('idle'); return; }
    const controller = new AbortController();
    setAvailability('loading');
    const timeout = window.setTimeout(() => controller.abort('timeout'), 15000);
    fetch(bookingApi.availability(data.date, data.staff ?? 'tina'), { cache: 'no-store', signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok || body.date !== data.date || !Array.isArray(body.taken) || body.taken.some((id: unknown) => !periods.some(period => period.id === id))) throw new Error('AVAILABILITY_FAILED'); return body.taken as string[]; })
      .then(values => { if (!controller.signal.aborted) { setTaken(values); setAvailability('ready'); } })
      .catch(() => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setAvailability('error'); })
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [data.date, data.staff, serverEnabled, receipt, availabilityRefresh]);

  useEffect(() => {
    if (!data.period || !taken.includes(data.period)) return;
    setData(current => ({ ...current, period: '' }));
    setErrors(current => ({ ...current, period: 'این بازه رزرو شده؛ ساعت دیگری انتخاب کن.' }));
  }, [taken, data.period]);

  useEffect(() => {
    function refresh() { const now = new Date(); setCurrentToday(todayInTehran(now)); setClockNow(now); }
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); };
  }, []);

  function change<K extends keyof BookingRequest>(key: K, value: BookingRequest[K]) {
    if (pending || receipt || data[key] === value) return;
    setData(current => { const next = { ...current, [key]: value }; if (key === 'date' || key === 'staff') next.period = ''; return next; });
    if (key === 'date' || key === 'staff') { setTaken([]);setAvailability('idle'); }
    setErrors(current => { const next = { ...current }; delete next[key]; delete next.form; if (key === 'date' || key === 'staff') delete next.period; return next; });
    token.current = null;
  }

  function showErrors(problems: Record<string, string>) {
    focusInvalid.current = true;
    if (problems.staff || problems.service || problems.date || problems.period) setStep(0);
    setErrors(problems);
  }

  function nextStep() {
    const now = new Date();
    setCurrentToday(todayInTehran(now)); setClockNow(now);
    const problems = selectionErrors(data, now);
    if (data.date && !problems.date && availability !== 'ready') {
      problems.period = availability === 'error'
        ? 'برای انتخاب ساعت مراجعه، دکمهٔ «بررسی دوبارهٔ ساعت‌ها» را بزن.'
        : 'بعد از دریافت ساعت‌های خالی، ساعت مراجعه را انتخاب کن.';
    }
    if (taken.includes(data.period)) problems.period = 'این بازه رزرو شده؛ ساعت دیگری انتخاب کن.';
    if (Object.keys(problems).length) { showErrors(problems); return; }
    setErrors({}); setStep(1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || receipt || !serverEnabled) return;
    if (step === 0) { nextStep(); return; }
    setCurrentToday(todayInTehran());
    const result = validateSubmission(data);
    if (!result.success && !token.current) { showErrors(result.errors); return; }
    if (result.success) setData(result.data);
    setPending(true); setErrors({});
    try {
      token.current ??= crypto.randomUUID();
      const response = await fetch(bookingApi.appointment, { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': token.current }, body: JSON.stringify(result.success ? result.data : data) });
      const body = await response.json();
      if (!response.ok) {
        showErrors(bookingFailureErrors(body));
        setCurrentToday(todayInTehran()); setClockNow(new Date());
        if (body.code === 'SLOT_TAKEN') { setData(current => ({ ...current, period: '' })); setAvailabilityRefresh(current => current + 1); token.current = null; }
        if (body.code === 'IDEMPOTENCY_CONFLICT') token.current = null;
        return;
      }
      const confirmed = receiptSchema.safeParse(body.receipt);
      if (!confirmed.success) throw new Error('INVALID_RECEIPT');
      setReceipt(confirmed.data); setStep(2);
    } catch { showErrors({ form: 'پاسخ ثبت نوبت دریافت نشد. دوباره تلاش کن؛ ارسال مجدد، نوبت تکراری نمی‌سازد.' }); }
    finally { setPending(false); }
  }

  const selectedService = services.find(item => item.id === data.service)!;
  const selectedStaff = staffMembers.find(item => item.id === (data.staff ?? 'tina'))!;
  const selectedPeriod = isUpcomingPeriod(data.date, data.period, clockNow) ? periods.find(item => item.id === data.period) : undefined;

  const slots = periods.map(period => {
    const unavailable = !isUpcomingPeriod(data.date, period.id, clockNow) ? 'شروع شده' : taken.includes(period.id) ? 'در دسترس نیست' : '';
    return { period, unavailable };
  });
  const freeCount = slots.filter(slot => !slot.unavailable).length;
  const slotsReady = availability === 'ready' && isAllowedDay(data.date, currentToday);
  const full = slotsReady && freeCount === 0;
  const nextDay = full ? nextJalaliDay(data.date) : '';
  const canCheckNext = nextDay !== '' && isAllowedDay(nextDay, currentToday);
  let timeHint = 'برای دیدن ساعت‌های آزاد، یک روز انتخاب کن.';
  if (data.date && serverEnabled) {
    if (availability === 'error') timeHint = 'دریافت ساعت‌ها انجام نشد.';
    else if (!isAllowedDay(data.date, currentToday)) timeHint = 'یک روز تازه از تقویم انتخاب کن.';
    else if (!slotsReady) timeHint = 'در حال بررسی ساعت‌های خالی…';
    else timeHint = full ? 'برای این روز ساعت آزادی باقی نمانده.' : `${faNumber(freeCount)} بازهٔ آزاد برای ${selectedStaff.name}`;
  }

  if (receipt) return <BookingReceipt receipt={receipt} headingRef={formHeading} notificationsDisabled={process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host'} />;

  return <form className="booking-sheet" onSubmit={submit} noValidate>
    <ol className="form-steps" aria-label="مراحل درخواست وقت"><li aria-current={step === 0 ? 'step' : undefined} className={step > 0 ? 'is-complete' : ''}><span aria-hidden="true">۱</span>خدمت و زمان</li><li aria-current={step === 1 ? 'step' : undefined}><span aria-hidden="true">۲</span>اطلاعات تماس</li></ol>
    <div className="form-heading"><h3 ref={formHeading} tabIndex={-1}>{step === 0 ? 'وقت دلخواهت را انتخاب کن' : 'چطور با تو هماهنگ کنیم؟'}</h3><span><Icon name="calendar" size={16} />نوبت‌های دوساعته · به وقت تهران</span></div>
    <p className="form-validation" role="alert" tabIndex={-1} hidden={!Object.keys(errors).length}>{Object.values(errors).join(' ')}</p>
    {!serverEnabled && <p className="booking-offline">رزرو آنلاین هنوز فعال نیست. <a href={salon.phoneLink}>هماهنگی تلفنی با تینا</a></p>}
    <fieldset disabled={pending} aria-busy={pending} className="booking-fields">
    {step === 0 ? <>
      <div className="booking-selection">
        <div className="treatment-panel">
          <StaffSelector value={data.staff ?? 'tina'} onChange={staff => change('staff', staff)} disabled={pending} error={errors.staff} />
          <fieldset className="service-choice" tabIndex={-1} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? 'service-error' : undefined}>
            <legend>انتخاب خدمت</legend>
            {errors.service && <p className="field-error" id="service-error">{errors.service}</p>}
            <div className="choice-row">{services.map(item => <label className={`choice service-option${data.service === item.id ? ' selected' : ''}`} key={item.id}>
              <input type="radio" name="service" value={item.id} aria-label={item.name} checked={data.service === item.id} onChange={() => change('service', item.id)} />
              <span><strong>{item.name}</strong><small>{item.subtitle}</small></span>
              <span className="service-radio" aria-hidden="true">{data.service === item.id && <Icon name="check" size={14} />}</span>
            </label>)}</div>
          </fieldset>
        </div>
        <div ref={datePanel} className="date-panel" role="group" tabIndex={-1} aria-labelledby="visit-day-title" aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-error' : undefined}>
          <h4 id="visit-day-title" className="selection-label">روز مراجعه</h4>
          {errors.date && <p className="field-error" id="date-error">{errors.date}</p>}
          <JalaliCalendar today={currentToday} selected={data.date} onSelect={key => change('date', key)} />
        </div>
        <fieldset ref={periodPanel} className="period-choice" tabIndex={-1} aria-invalid={Boolean(errors.period)} aria-describedby={errors.period ? 'period-error' : 'period-hint'}>
          <legend>ساعت مراجعه <span className="duration-note">۲ ساعت</span></legend>
          {errors.period && <p className="field-error" id="period-error">{errors.period}</p>}
          <p id="period-hint" className="time-hint" role="status">{timeHint}</p>
          {slotsReady && <div className="time-grid">{slots.map(({ period, unavailable }) => <label className={data.period === period.id ? 'choice time-choice selected' : 'choice time-choice'} key={period.id}>
            <input type="radio" name="period" value={period.id} aria-label={`ساعت ${period.label}${unavailable ? `، ${unavailable}` : ''}`} checked={data.period === period.id} disabled={Boolean(unavailable)} onChange={() => change('period', period.id)} />
            <span>{period.label}{unavailable && <small>{unavailable}</small>}</span><Icon name="check" size={17} />
          </label>)}</div>}
          {availability === 'error' && <button type="button" className="text-button" onClick={() => setAvailabilityRefresh(current => current + 1)}>بررسی دوبارهٔ ساعت‌ها</button>}
          {full && <button type="button" className="text-button" onClick={() => {
            if (canCheckNext) { periodPanel.current?.focus({preventScroll: true}); change('date', nextDay); }
            else { datePanel.current?.focus({preventScroll: true}); datePanel.current?.scrollIntoView({block: 'start'}); }
          }}>{canCheckNext ? 'بررسی روز بعد' : 'انتخاب روز دیگر'}</button>}
        </fieldset>
      </div>
      <div className="booking-next">
        <div className="selection-recap" aria-live="polite"><strong>{selectedService.name} · با {selectedStaff.name}</strong><span>{data.date ? readableDay(data.date) : 'روز را انتخاب کن'}<span aria-hidden="true"> · </span>{selectedPeriod ? `ساعت ${selectedPeriod.label}` : 'ساعت را انتخاب کن'}</span></div>
        <button type="submit" disabled={!serverEnabled} className="button primary booking-cta">ادامه و ثبت اطلاعات <Icon name="arrow" size={20} /></button>
      </div>
    </> : <>
      <div className="selected-appointment"><span>{selectedStaff.name} · {selectedService.name}</span><span>{readableDay(data.date)}</span><span>ساعت {periods.find(item => item.id === data.period)?.label}</span><button className="text-button" type="button" onClick={() => setStep(0)}>تغییر وقت</button></div>
      <div className="fields-grid"><div className="field"><label htmlFor="name">نام و نام خانوادگی</label><input id="name" name="name" autoComplete="name" value={data.name} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} onChange={event => change('name', event.target.value)} placeholder="نامت را بنویس" />{errors.name && <p id="name-error" className="field-error">{errors.name}</p>}</div><div className="field"><label htmlFor="phone">شمارهٔ موبایل</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={data.phone} maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} onChange={event => change('phone', event.target.value)} placeholder="09..." />{errors.phone && <p id="phone-error" className="field-error">{errors.phone}</p>}</div></div>
      <div className="field"><label htmlFor="note">چیزی هست که قبل از وقتت بدانم؟ <span>(اختیاری)</span></label><textarea id="note" name="note" rows={3} maxLength={500} value={data.note} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? 'note-error' : undefined} onChange={event => change('note', event.target.value)} placeholder="مثلاً مدل یا رنگ دلخواهت؛ اطلاعات حساس ننویس." />{errors.note && <p className="field-error" id="note-error">{errors.note}</p>}</div>
      <label className="consent"><input type="checkbox" checked={data.consent} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} onChange={event => change('consent', event.target.checked)} /><span>با استفاده از این اطلاعات برای هماهنگی وقتم موافقم. <Link href="/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی<span className="sr-only"> (در برگهٔ تازه)</span></Link></span></label>
      {errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}
      <button type="submit" disabled={pending || !serverEnabled} className="button primary full booking-cta">{pending ? 'در حال رزرو وقت…' : 'رزرو نهایی و دریافت رسید'}<Icon name="check" size={20} /></button>
      <a className="form-contact" href={salon.phoneLink}>ترجیح می‌دهی تلفنی هماهنگ کنی؟ تماس با تینا</a>
    </>}
    </fieldset>
  </form>;
}
