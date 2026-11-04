'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { manicureOptions, periods, services, salon, type ServiceId } from '@/content/salon';
import { isAllowedDay, readableDay, todayInTehran } from '@/lib/jalali';
import { isUpcomingPeriod, selectionErrors, validateSubmission, whatsappRequestUrl, type BookingRequest } from './model';
import { JalaliCalendar } from './JalaliCalendar';

export function BookingForm({ today, initialNow, serverEnabled }: { today: string; initialNow: string; serverEnabled: boolean }) {
  const [step, setStep] = useState(0);
  const [currentToday, setCurrentToday] = useState(today);
  const [clockNow, setClockNow] = useState(() => new Date(initialNow));
  const [data, setData] = useState<BookingRequest>({ name: '', phone: '', service: 'manicure', manicureType: '', date: '', period: '', note: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reference, setReference] = useState('');
  const [useWhatsapp, setUseWhatsapp] = useState(!serverEnabled);
  const token = useRef<string | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const focusInvalid = useRef(false);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    formHeading.current?.focus();
    formHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);

  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    const target = formHeading.current?.closest('form')?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formHeading.current;
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [errors, step]);

  useEffect(() => {
    const select = (event: Event) => { if (pending || saved) return; const service = (event as CustomEvent).detail as ServiceId; if (services.some(item => item.id === service)) { setData(current => ({ ...current, service, manicureType: service === 'manicure' ? current.manicureType : '' })); setErrors({}); token.current = null; setStep(0); } };
    window.addEventListener('select-service', select);
    return () => window.removeEventListener('select-service', select);
  }, [pending, saved]);

  useEffect(() => {
    function refresh() { const now = new Date(); setCurrentToday(todayInTehran(now)); setClockNow(now); }
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); };
  }, []);

  function change<K extends keyof BookingRequest>(key: K, value: BookingRequest[K]) {
    if (pending || saved) return;
    setData(current => { const next = { ...current, [key]: value }; if (key === 'service' && value === 'pedicure') next.manicureType = ''; return next; });
    setErrors(current => { const next = { ...current }; delete next[key]; delete next.form; if (key === 'service') delete next.manicureType; if (key === 'date') delete next.period; return next; });
    token.current = null;
  }

  function nextStep() {
    const now = new Date();
    setCurrentToday(todayInTehran(now)); setClockNow(now);
    const problems = selectionErrors(data, now);
    if (Object.keys(problems).length) { focusInvalid.current = true; setErrors(problems); return; }
    setErrors({}); setStep(1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || saved) return;
    setCurrentToday(todayInTehran());
    const result = validateSubmission(data);
    if (!result.success) { focusInvalid.current = true; setErrors(result.errors); if (result.errors.date || result.errors.period || result.errors.manicureType) setStep(0); return; }
    setData(result.data);
    if (useWhatsapp) { setSaved(false); setStep(2); return; }
    setPending(true); setErrors({});
    try {
      token.current ??= crypto.randomUUID();
      const response = await fetch('/api/appointment-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': token.current }, body: JSON.stringify(result.data) });
      const body = await response.json();
      if (!response.ok) { setErrors(body.errors ?? { form: body.message ?? 'ثبت درخواست انجام نشد. دوباره تلاش کن یا در واتس‌اپ پیام بده.' }); if (body.errors?.date || body.errors?.period || body.errors?.manicureType) { setStep(0); setCurrentToday(todayInTehran()); setClockNow(new Date()); } setUseWhatsapp(response.status === 503); return; }
      setReference(body.reference); setSaved(true); setStep(2);
    } catch { setErrors({ form: 'ارتباط برقرار نشد. اطلاعاتت همین‌جا مانده؛ می‌توانی آن را در واتس‌اپ بفرستی.' }); setUseWhatsapp(true); }
    finally { setPending(false); }
  }

  function openWhatsapp(event: React.MouseEvent<HTMLAnchorElement>) {
    if (saved) return;
    const now = new Date();
    const result = validateSubmission(data, now);
    if (result.success) return;
    event.preventDefault();
    setCurrentToday(todayInTehran(now)); setClockNow(now); setErrors(result.errors);
    setStep(result.errors.date || result.errors.period || result.errors.manicureType ? 0 : 1);
  }

  const selectedService = services.find(item => item.id === data.service)!;
  const selectedTreatment = data.service === 'manicure' ? manicureOptions.find(item => item.id === data.manicureType)?.label : '';
  const selectedPeriod = isUpcomingPeriod(data.date, data.period, clockNow) ? periods.find(item => item.id === data.period) : undefined;

  if (step === 2) return <div className="booking-sheet booking-result" role="region" aria-labelledby="booking-result-title">
    <span className="result-mark"><Icon name="check" size={30} /></span>
    <h3 id="booking-result-title" ref={formHeading} tabIndex={-1}>{saved ? 'درخواستت ثبت شد.' : 'پیامت آمادهٔ ارسال است.'}</h3>
    <p>{saved ? 'برای هماهنگی زمان دقیق با تو تماس می‌گیریم. این پیام، تأیید نهایی نوبت نیست.' : 'روی دکمهٔ زیر بزن و پیام آماده‌شده را در واتس‌اپ بفرست. بعد از هماهنگی با تینا، نوبتت نهایی می‌شود.'}</p>
    <dl className="request-summary">
      <div><dt>خدمت</dt><dd>{services.find(item => item.id === data.service)!.name}</dd></div>
      {data.service === 'manicure' && <div><dt>نوع مانیکور</dt><dd>{manicureOptions.find(item => item.id === data.manicureType)?.label}</dd></div>}
      <div><dt>روز دلخواه</dt><dd>{readableDay(data.date)}</dd></div>
      <div><dt>ساعت</dt><dd>{periods.find(item => item.id === data.period)?.label}</dd></div>
      {reference && <div><dt>کد پیگیری</dt><dd dir="ltr">{reference}</dd></div>}
    </dl>
    <a className="button primary full booking-cta" onClick={openWhatsapp} onAuxClick={openWhatsapp} href={saved ? `${salon.whatsapp}?text=${encodeURIComponent(`سلام تینا، برای پیگیری یا اصلاح درخواست با کد ${reference} پیام می‌دهم.`)}` : whatsappRequestUrl(data)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{saved ? 'پیگیری یا اصلاح درخواست در واتس‌اپ' : 'ارسال درخواست در واتس‌اپ'}</a>
    {!saved && <button className="text-button" type="button" onClick={() => setStep(1)}>ویرایش اطلاعات</button>}
  </div>;

  return <form className="booking-sheet" onSubmit={submit} noValidate>
    <ol className="form-steps" aria-label="مراحل درخواست وقت"><li aria-current={step === 0 ? 'step' : undefined} className={step > 0 ? 'is-complete' : ''}><span aria-hidden="true">۱</span>خدمت و زمان</li><li aria-current={step === 1 ? 'step' : undefined}><span aria-hidden="true">۲</span>اطلاعات تماس</li></ol>
    <div className="form-heading"><h3 ref={formHeading} tabIndex={-1}>{step === 0 ? 'وقت دلخواهت را انتخاب کن' : 'چطور با تو هماهنگ کنیم؟'}</h3><span><Icon name="calendar" size={16} />نوبت‌های دوساعته · به وقت تهران</span></div>
    <p className="form-validation" role="alert" hidden={!Object.keys(errors).length}>{Object.values(errors).join(' ')}</p>
    <fieldset disabled={pending} aria-busy={pending} className="booking-fields">
    {step === 0 ? <>
      <div className="booking-selection">
        <div className="treatment-panel">
          <fieldset className="service-choice"><legend>انتخاب خدمت</legend><div className="choice-row">{services.map(item => <label className={`choice service-option${data.service === item.id ? ' selected' : ''}`} key={item.id}><input type="radio" name="service" value={item.id} aria-label={item.name} checked={data.service === item.id} onChange={() => change('service', item.id)} /><span><strong>{item.name}</strong><small>{item.subtitle}</small></span><span className="service-radio" aria-hidden="true">{data.service === item.id && <Icon name="check" size={14} />}</span></label>)}</div></fieldset>
          {data.service === 'manicure' && <fieldset className="manicure-choice" aria-describedby={errors.manicureType ? 'manicure-error' : undefined}><legend>نوع مانیکور</legend><div className="choice-row">{manicureOptions.map(item => <label className={data.manicureType === item.id ? 'choice selected' : 'choice'} key={item.id}><input type="radio" name="manicureType" value={item.id} checked={data.manicureType === item.id} aria-invalid={Boolean(errors.manicureType)} onChange={() => change('manicureType', item.id)} />{item.label}</label>)}</div>{errors.manicureType && <p className="field-error" id="manicure-error">{errors.manicureType}</p>}</fieldset>}
          <p className="treatment-note">اگر مدل یا طرحی در ذهن داری، در مرحلهٔ بعد برایم بنویس.</p>
        </div>
        <div className="date-panel" role="group" aria-labelledby="visit-day-title">
          <h4 id="visit-day-title" className="selection-label">روز مراجعه</h4>
          <JalaliCalendar today={currentToday} selected={data.date} onSelect={key => change('date', key)} />
          {errors.date && <p className="field-error" role="alert">{errors.date}</p>}
        </div>
        <fieldset className="period-choice" aria-describedby={errors.period ? 'period-error' : 'period-hint'}><legend>ساعت مراجعه <span className="duration-note">۲ ساعت</span></legend><div className="time-grid">{periods.map(item => <label className={data.period === item.id ? 'choice time-choice selected' : 'choice time-choice'} key={item.id}><input type="radio" name="period" value={item.id} aria-label={`ساعت ${item.label}`} checked={data.period === item.id} disabled={!isUpcomingPeriod(data.date, item.id, clockNow)} onChange={() => change('period', item.id)} /><span>{item.label}</span><Icon name="check" size={17} /></label>)}</div><p id="period-hint" className="time-hint">{!data.date ? 'اول روز دلخواهت را انتخاب کن تا ساعت‌ها فعال شوند.' : isAllowedDay(data.date, currentToday) && periods.every(item => !isUpcomingPeriod(data.date, item.id, clockNow)) ? 'بازه‌های امروز تمام شده‌اند؛ روز دیگری انتخاب کن.' : 'بازهٔ مناسب خودت را انتخاب کن.'}</p>{errors.period && <p className="field-error" id="period-error">{errors.period}</p>}<p className="slot-note">زمان نهایی پس از هماهنگی تأیید می‌شود.</p></fieldset>
      </div>
      <div className="booking-next">
        <div className="selection-recap" aria-live="polite"><strong>{selectedService.name}{selectedTreatment ? ` · ${selectedTreatment}` : ''}</strong><span>{data.date ? readableDay(data.date) : 'روز را انتخاب کن'}<span aria-hidden="true"> · </span>{selectedPeriod ? `ساعت ${selectedPeriod.label}` : 'ساعت را انتخاب کن'}</span></div>
        <button type="button" className="button primary booking-cta" onClick={nextStep}>ادامه و ثبت اطلاعات <Icon name="arrow" size={20} /></button>
      </div>
    </> : <>
      <div className="selected-appointment"><span>{services.find(item => item.id === data.service)!.name}{data.service === 'manicure' ? ` · ${manicureOptions.find(item => item.id === data.manicureType)?.label}` : ''}</span><span>{readableDay(data.date)}</span><span>ساعت {periods.find(item => item.id === data.period)?.label}</span><button className="text-button" type="button" onClick={() => setStep(0)}>تغییر وقت</button></div>
      <div className="fields-grid"><div className="field"><label htmlFor="name">نام و نام خانوادگی</label><input id="name" name="name" autoComplete="name" value={data.name} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} onChange={event => change('name', event.target.value)} placeholder="نامت را بنویس" />{errors.name && <p id="name-error" className="field-error">{errors.name}</p>}</div><div className="field"><label htmlFor="phone">شمارهٔ موبایل</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={data.phone} maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} onChange={event => change('phone', event.target.value)} placeholder="09..." />{errors.phone && <p id="phone-error" className="field-error">{errors.phone}</p>}</div></div>
      <div className="field"><label htmlFor="note">چیزی هست که قبل از وقتت بدانم؟ <span>(اختیاری)</span></label><textarea id="note" name="note" rows={3} maxLength={500} value={data.note} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? 'note-error' : undefined} onChange={event => change('note', event.target.value)} placeholder="مثلاً مدل یا رنگ دلخواهت؛ اطلاعات حساس ننویس." />{errors.note && <p className="field-error" id="note-error">{errors.note}</p>}</div>
      <label className="consent"><input type="checkbox" checked={data.consent} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} onChange={event => change('consent', event.target.checked)} /><span>با استفاده از این اطلاعات برای هماهنگی وقتم موافقم. <Link href="/privacy">حریم خصوصی</Link></span></label>
      {errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <button type="submit" disabled={pending} className="button primary full booking-cta">{pending ? 'در حال ثبت درخواست…' : useWhatsapp ? 'آماده‌کردن درخواست برای واتس‌اپ' : 'ثبت درخواست وقت'}<Icon name={useWhatsapp ? 'whatsapp' : 'arrow'} size={20} /></button>
      <p className="form-disclaimer">{useWhatsapp ? 'پیام در واتس‌اپ باز می‌شود و خودت آن را ارسال می‌کنی.' : 'پس از ثبت، برای نهایی‌کردن نوبت با تو هماهنگ می‌کنیم.'}</p>
      <a className="form-contact" href={salon.phoneLink}>ترجیح می‌دهی تلفنی هماهنگ کنی؟ تماس با تینا</a>
    </>}
    </fieldset>
  </form>;
}
