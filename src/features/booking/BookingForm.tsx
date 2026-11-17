'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { periods, services, salon, staffMembers, type ServiceId } from '@/content/salon';
import { readableDay } from '@/lib/jalali';
import { isUpcomingPeriod, selectionErrors, validateSubmission, type BookingRequest } from './model';
import { QuickTimes, ManualTimes, ConflictTimes } from './BookingTimes';
import { sameTime, type BookingSlot } from './booking-options';
import { useBookingTimes } from './use-booking-times';
import { BookingReceipt } from './BookingReceipt';
import { receiptSchema, type BookingReceiptData } from './receipt-model';
import { rememberBookingReceipt } from './receipt-access';
import { bookingMeasurementHeaders, startBookingMeasurement, markTimeSelected, markBookingCompleted } from './booking-metrics';
import { bookingApi, bookingFailureErrors } from './transport';

export function BookingForm({ initialNow, serverEnabled }: { today: string; initialNow: string; serverEnabled: boolean }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BookingRequest>({ name: '', phone: '', service: 'manicure', date: '', period: '', note: '', consent: false, staff: 'tina' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<BookingReceiptData | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [conflict, setConflict] = useState<BookingSlot | null>(null);
  const { status, open, today, clock, now, refresh } = useBookingTimes(serverEnabled && !receipt, initialNow);
  const token = useRef<string | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const focusNext = useRef<'error' | 'conflict' | 'summary' | null>(null);
  const start = useCallback(() => {
    if (receipt || !serverEnabled || formHeading.current?.closest('[hidden]')) return;
    startBookingMeasurement();
  }, [receipt, serverEnabled]);

  useEffect(() => {
    const stepChanged = previousStep.current !== step;
    previousStep.current = step;
    const destination = focusNext.current;
    if (!stepChanged && !destination) return;
    const heading = formHeading.current;
    const form = heading?.closest('form');
    let target: HTMLElement | null | undefined = heading;
    if (destination === 'error') target = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>('.form-validation');
    if (destination === 'conflict') target = form?.querySelector<HTMLElement>('#conflict-heading');
    if (destination === 'summary') target = form?.querySelector<HTMLElement>('.booking-next, .selected-appointment');
    focusNext.current = null;
    if (target) {
      target.focus({ preventScroll: true });
      const block = destination === 'summary' ? 'nearest' : target.matches('input, textarea, select') ? 'center' : 'start';
      target.scrollIntoView({ block, behavior: 'instant' });
    }
  }, [errors, step, conflict]);

  useEffect(() => {
    const region = document.getElementById('appointment-form');
    function selectService(event: Event) {
      if (pending || receipt) return;
      const service = (event as CustomEvent).detail as ServiceId;
      if (!services.some(item => item.id === service)) return;
      start();
      setData(current => ({ ...current, service, period: conflict ? '' : current.period }));
      setConflict(null);
      setErrors({});
      token.current = null;
      setStep(0);
    }
    function bookingLink(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('a[href="#appointment-form"]')) start();
    }
    region?.addEventListener('focus', start);
    if (region && region === document.activeElement && location.hash === '#appointment-form') start();
    document.addEventListener('click', bookingLink);
    window.addEventListener('select-service', selectService);
    return () => {
      region?.removeEventListener('focus', start);
      document.removeEventListener('click', bookingLink);
      window.removeEventListener('select-service', selectService);
    };
  }, [pending, receipt, conflict, start]);

  function change<K extends keyof BookingRequest>(key: K, value: BookingRequest[K]) {
    if (pending || receipt || data[key] === value) return;
    setData(current => {
      const next = { ...current, [key]: value };
      if (key === 'date' || key === 'staff') next.period = '';
      return next;
    });
    setErrors(current => {
      const next = { ...current };
      delete next[key]; delete next.form;
      if (key === 'date' || key === 'staff') delete next.period;
      return next;
    });
    token.current = null;
  }

  function showErrors(problems: Record<string, string>) {
    focusNext.current = 'error';
    if (problems.staff || problems.service || problems.date || problems.period) setStep(0);
    if (problems.staff || problems.date || problems.period) setManualOpen(true);
    setErrors(problems);
  }

  function chooseSlot(slot: BookingSlot, source: 'quick' | 'manual' | 'replacement') {
    if (pending || receipt) return;
    if (status !== 'ready' || !open[slot.staff].some(option => sameTime(option, slot)) || !isUpcomingPeriod(slot.date, slot.period, now())) {
      void refresh();
      if (source !== 'replacement') showErrors({ period: 'این وقت دیگر در دسترس نیست. یک ساعت تازه انتخاب کن.' });
      return;
    }
    start();
    markTimeSelected();
    if (source !== 'manual') focusNext.current = 'summary';
    if (source === 'quick') setManualOpen(false);
    setData(current => ({ ...current, ...slot }));
    setErrors({});
    setConflict(null);
    token.current = null;
  }

  function editSchedule() {
    if (conflict) {
      setData(current => ({ ...current, period: '' }));
      setConflict(null);
    }
    setManualOpen(true);
    setErrors({});
    setStep(0);
  }

  function showConflict(slot: BookingSlot) {
    focusNext.current = 'conflict';
    setConflict(slot);
    setErrors({});
    setStep(1);
    token.current = null;
  }

  function nextStep() {
    const problems = selectionErrors(data, now());
    if (data.date && !problems.date && status !== 'ready') {
      problems.period = status === 'error'
        ? 'برای انتخاب ساعت مراجعه، دکمهٔ «بررسی دوبارهٔ ساعت‌ها» را بزن.'
        : 'بعد از دریافت ساعت‌های خالی، ساعت مراجعه را انتخاب کن.';
    }
    if (Object.keys(problems).length) { showErrors(problems); return; }
    const staff = data.staff ?? 'tina';
    if (data.period && !open[staff].some(slot => sameTime(data, slot))) {
      showConflict({ staff, date: data.date, period: data.period });
      return;
    }
    setErrors({});
    setStep(1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || receipt || !serverEnabled || conflict) return;
    start();
    if (step === 0) { nextStep(); return; }
    const result = validateSubmission(data, now());
    if (!result.success && !token.current) { showErrors(result.errors); return; }
    setPending(true);
    setErrors({});
    try {
      token.current ??= crypto.randomUUID();
      const response = await fetch(bookingApi.appointment, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': token.current, ...bookingMeasurementHeaders() },
        body: JSON.stringify(result.success ? result.data : data),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.code === 'SLOT_TAKEN' && data.period) {
          showConflict({ staff: data.staff ?? 'tina', date: data.date, period: data.period });
          void refresh();
          return;
        }
        if (body.code === 'IDEMPOTENCY_CONFLICT') token.current = null;
        showErrors(bookingFailureErrors(body));
        return;
      }
      const confirmed = receiptSchema.safeParse(body.receipt);
      if (!confirmed.success) throw new Error('INVALID_RECEIPT');
      rememberBookingReceipt(confirmed.data.reference, token.current!);
      markBookingCompleted();
      setReceipt(confirmed.data);
      setStep(2);
    } catch {
      showErrors({ form: 'پاسخ ثبت نوبت دریافت نشد. دوباره تلاش کن؛ ارسال مجدد، نوبت تکراری نمی‌سازد.' });
    } finally { setPending(false); }
  }

  const selectedService = services.find(item => item.id === data.service)!;
  const selectedStaff = staffMembers.find(item => item.id === (data.staff ?? 'tina'))!;
  const selectedPeriod = isUpcomingPeriod(data.date, data.period, clock) && (status !== 'ready' || open[selectedStaff.id].some(slot => sameTime(slot, data)))
    ? periods.find(item => item.id === data.period) : undefined;

  if (receipt) return <BookingReceipt receipt={receipt} headingRef={formHeading} notificationsDisabled={process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host'} />;

  return <form className="booking-sheet" onSubmit={submit} onFocusCapture={start} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('button, input, select, textarea, label, a[href]')) start();
  }} noValidate>
    <ol className="form-steps" aria-label="مراحل درخواست وقت"><li aria-current={step === 0 ? 'step' : undefined} className={step > 0 ? 'is-complete' : ''}><span aria-hidden="true">۱</span>خدمت و زمان</li><li aria-current={step === 1 ? 'step' : undefined}><span aria-hidden="true">۲</span>اطلاعات تماس</li></ol>
    <div className="form-heading"><h3 ref={formHeading} tabIndex={-1}>{step === 0 ? 'وقت دلخواهت را انتخاب کن' : 'چطور با تو هماهنگ کنیم؟'}</h3><span><Icon name="calendar" size={16} />نوبت‌های دوساعته · به وقت تهران</span></div>
    <p className="form-validation" role="alert" tabIndex={-1} hidden={!Object.keys(errors).length}>{Object.values(errors).join(' ')}</p>
    {!serverEnabled && <p className="booking-offline">رزرو آنلاین هنوز فعال نیست. <a href={salon.phoneLink}>هماهنگی تلفنی با تینا</a></p>}
    <fieldset disabled={pending} aria-busy={pending} className="booking-fields">
    {step === 0 ? <>
      <div className="booking-overview">
        <QuickTimes data={data} open={open} status={status} today={today} select={slot => chooseSlot(slot, 'quick')} retry={refresh} />
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
      <button type="button" className="schedule-toggle" aria-expanded={manualOpen} aria-controls="manual-booking-times" onClick={() => setManualOpen(value => !value)}>
        <Icon name="calendar" size={18} />انتخاب روز و ساعت از تقویم<Icon name="chevron" size={16} />
      </button>
      <div id="manual-booking-times" hidden={!manualOpen}>
        {manualOpen && <ManualTimes data={data} errors={errors} today={today} clock={clock} status={status} open={open} retry={refresh}
          selectStaff={staff => change('staff', staff)} selectDay={day => change('date', day)}
          selectPeriod={period => chooseSlot({ staff: selectedStaff.id, date: data.date, period }, 'manual')} />}
      </div>
      <div className="booking-next" tabIndex={-1} role="group" aria-label="خلاصهٔ انتخاب و ادامه">
        <div className="selection-recap" aria-live="polite"><strong>{selectedService.name} · با {selectedStaff.name}</strong><span>{data.date ? readableDay(data.date) : 'روز را انتخاب کن'}<span aria-hidden="true"> · </span>{selectedPeriod ? `ساعت ${selectedPeriod.label}` : 'ساعت را انتخاب کن'}</span></div>
        <button type="submit" disabled={!serverEnabled} className="button primary booking-cta">ادامه و ثبت اطلاعات <Icon name="arrow" size={20} /></button>
      </div>
    </> : <>
      {conflict && <ConflictTimes requested={conflict} open={open} status={status} select={slot => chooseSlot(slot, 'replacement')} retry={refresh} manual={editSchedule} />}
      <div className="selected-appointment" tabIndex={-1} role="group" aria-label="وقت انتخابی"><span>{selectedStaff.name} · {selectedService.name}</span><span>{readableDay(data.date)}</span><span>ساعت {periods.find(item => item.id === data.period)?.label}</span>{!conflict && <button className="text-button" type="button" onClick={editSchedule}>تغییر وقت</button>}</div>
      <div className="fields-grid"><div className="field"><label htmlFor="name">نام و نام خانوادگی</label><input id="name" name="name" autoComplete="name" value={data.name} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} onChange={event => change('name', event.target.value)} placeholder="نامت را بنویس" />{errors.name && <p id="name-error" className="field-error">{errors.name}</p>}</div><div className="field"><label htmlFor="phone">شمارهٔ موبایل</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={data.phone} maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} onChange={event => change('phone', event.target.value)} placeholder="09..." />{errors.phone && <p id="phone-error" className="field-error">{errors.phone}</p>}</div></div>
      <div className="field"><label htmlFor="note">چیزی هست که قبل از وقتت بدانم؟ <span>(اختیاری)</span></label><textarea id="note" name="note" rows={3} maxLength={500} value={data.note} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? 'note-error' : undefined} onChange={event => change('note', event.target.value)} placeholder="مثلاً مدل یا رنگ دلخواهت؛ اطلاعات حساس ننویس." />{errors.note && <p className="field-error" id="note-error">{errors.note}</p>}</div>
      <label className="consent"><input type="checkbox" checked={data.consent} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} onChange={event => change('consent', event.target.checked)} /><span>با استفاده از این اطلاعات برای هماهنگی وقتم موافقم. <Link href="/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی<span className="sr-only"> (در برگهٔ تازه)</span></Link></span></label>
      {errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}
      <button type="submit" disabled={pending || !serverEnabled || Boolean(conflict)} className="button primary full booking-cta">{pending ? 'در حال رزرو وقت…' : 'رزرو نهایی و دریافت رسید'}<Icon name="check" size={20} /></button>
      <a className="form-contact" href={salon.phoneLink}>ترجیح می‌دهی تلفنی هماهنگ کنی؟ تماس با تینا</a>
    </>}
    </fieldset>
  </form>;
}
