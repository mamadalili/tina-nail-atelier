'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Icon } from '@/components/Icon';
import { salon, periods } from '@/content/salon';
import { faNumber, months } from '@/lib/jalali';
import { listBookingReceipts } from './receipt-access';
import type { BookingReceiptData, ReceiptProof } from './receipt-model';
import { useLiveReceipt } from './use-live-receipt';
import { ReceiptEditor } from './ReceiptEditor';
import './receipt.css';

type Props = ({ receipt: BookingReceiptData; proof?: never } | { proof: ReceiptProof; receipt?: never }) & {
  preview?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  notificationsDisabled?: boolean;
};

export function BookingReceipt({ receipt: initial, proof: stored, preview = false, headingRef, notificationsDisabled = false }: Props) {
  const [issuedProof] = useState(() => initial && !preview ? listBookingReceipts().find(entry => entry.reference === initial.reference) : undefined);
  const proof = preview ? undefined : stored ?? issuedProof;
  const { state, refresh, canEdit, change, closeEditor } = useLiveReceipt(proof, initial);
  const referenceElement = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const moveButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    if ((state.status === 'error' && (state.calendar || state.uncertain)) || (state.status === 'ready' && state.notice)) {
      feedback.current?.focus({ preventScroll: true });
    }
  }, [state]);

  if (state.status !== 'ready') {
    return <div className="receipt-lookup">
      <p role="status" ref={feedback} tabIndex={-1}>{state.status === 'loading'
        ? state.calendar ? 'در حال بررسی نوبت برای تقویم…' : 'در حال دریافت وضعیت نوبت…'
        : state.uncertain ? 'وضعیت فعلی نوبت پس از درخواست تغییر مشخص نیست. رسید را دوباره دریافت کن یا با تینا تماس بگیر.'
          : state.calendar ? 'وضعیت نوبت دریافت نشد و فایل تقویم آماده نشد.' : 'وضعیت نوبت دریافت نشد. دوباره تلاش کن یا با تینا تماس بگیر.'}</p>
      {state.status === 'error' && <div><button type="button" className="text-button" onClick={() => void refresh()}>دریافت دوبارهٔ رسید</button><a className="text-button" href={salon.phoneLink}>تماس با تینا</a></div>}
    </div>;
  }
  const { receipt, checked: reopened } = state;
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(receipt.reference);
      setCopyMessage('کد پیگیری کپی شد.');
    } catch {
      const selection = window.getSelection();
      if (selection && referenceElement.current) {
        const range = document.createRange(); range.selectNodeContents(referenceElement.current);
        selection.removeAllRanges(); selection.addRange(range);
      }
      setCopyMessage('کد پیگیری را دستی کپی کن.');
    }
  }
  const [year, month, day] = receipt.date.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(new Date(receipt.startsAt));
  const cancelled = receipt.status === 'CANCELLED';
  const heading = preview ? 'رسید وقتت این شکلی می‌شود.' : cancelled ? 'این نوبت لغو شده است.' : reopened || !proof ? 'رسید نوبتت' : 'وقتت رزرو شد.';
  const status = preview ? 'نمونهٔ نمایشی' : cancelled ? 'نوبت لغوشده' : !proof ? 'رسید زمان ثبت' : 'نوبت قطعی';
  return <div className="receipt-experience" role="region" aria-label="رسید نوبت">
    {preview && <p className="preview-notice">پیش‌نمایش طرح رسید؛ این نوبت ثبت نشده است.</p>}
    <div className="receipt-intro"><span className={`receipt-check${cancelled ? ' is-cancelled' : ''}`}><Icon name={cancelled ? 'close' : 'check'} size={22} /></span><h3 ref={headingRef} tabIndex={-1}>{heading}</h3>
      {preview ? <p>نمونهٔ نمایشی برای بررسی طراحی</p> : !proof ? <p>برای پیگیری وضعیت فعلی این نوبت با تینا تماس بگیر.</p> : !cancelled && !reopened && <p>این وقت برای توست. رسیدت را نگه دار.</p>}
    </div>
    <article className={`appointment-ticket${cancelled ? ' ticket-cancelled' : ''}`} aria-label={preview ? 'نمونهٔ رسید نوبت' : cancelled ? 'رسید نوبت لغوشده' : 'رسید نهایی رزرو وقت'}>
      <header className="ticket-masthead"><div><span className="ticket-wordmark" lang="en" dir="ltr">Tina<span>.</span></span><span className="ticket-atelier">آتلیهٔ ناخن تینا</span></div><div className="ticket-status"><Icon name={cancelled ? 'close' : 'check'} size={16} />{status}<small lang="en" dir="ltr">{cancelled ? 'CANCELLED' : 'APPOINTMENT PASS'}</small></div></header>
      <div className="ticket-body">
        <div className="ticket-guest"><span className="ticket-label">مهمان ما</span><strong>{receipt.name}</strong></div>
        <div className="ticket-when"><div className="ticket-date"><span className="ticket-label">{weekday}</span><strong>{faNumber(day)} <span>{months[month - 1]}</span></strong><small>{faNumber(year)}</small></div><div className="ticket-time"><span className="ticket-label">ساعت مراجعه</span><strong>{periods.find(item => item.id === receipt.period)!.label}</strong><small>به وقت تهران · ۲ ساعت</small></div></div>
        <div className="ticket-service"><span className="ticket-label">برای تو</span><strong>{receipt.service}{receipt.treatment && <span> / {receipt.treatment}</span>}</strong></div>
        <div className="ticket-location"><span className="ticket-label">وقت با</span><strong>{receipt.staffName}</strong></div>
        <div className="ticket-location"><span className="ticket-label">آدرس</span><span>تهران، {salon.address}</span></div>
      </div>
      <footer className="ticket-stub"><div><span className="ticket-label">کد پیگیری نوبت</span><strong ref={referenceElement} dir="ltr">{receipt.reference}</strong></div><button type="button" className="text-button ticket-copy" onClick={copyReference}>کپی کد پیگیری</button></footer>
    </article>
    <p className="copy-status" role="status">{copyMessage}</p>
    {state.notice && <p className="copy-status" role="status" ref={feedback} tabIndex={-1}>{state.notice}</p>}
    {proof && !preview && !state.editor && <div className="receipt-manage">
      {canEdit && <>
        <button className="button ticket-manage" ref={moveButton} type="button" disabled={state.saving} onClick={() => void refresh('reschedule')}>تغییر زمان نوبت</button>
        <button className="text-button ticket-cancel" ref={cancelButton} type="button" disabled={state.saving} onClick={() => void refresh('cancel')}>لغو نوبت</button>
        {state.saving && <p role="status">در حال بررسی وضعیت نوبت…</p>}
      </>}
      {!state.checked && !cancelled && Date.parse(receipt.startsAt) > Date.now() && <button className="button ticket-manage" type="button" onClick={() => void refresh()}>بررسی و مدیریت نوبت</button>}
    </div>}
    {canEdit && state.editor && <ReceiptEditor key={state.editor} mode={state.editor} receipt={receipt} pending={state.saving} onChange={change} onClose={() => {
      const trigger = state.editor === 'cancel' ? cancelButton : moveButton;
      closeEditor();
      requestAnimationFrame(() => trigger.current?.focus());
    }} />}
    <div className="receipt-actions">
      {proof && !preview && !cancelled && <button className="button primary ticket-calendar" type="button" disabled={state.saving} onClick={() => void refresh('calendar')}><Icon name="calendar" size={18} />افزودن به تقویم گوشی</button>}
      <button type="button" className="button ticket-print" disabled={state.saving} onClick={() => window.print()}>چاپ یا ذخیرهٔ PDF</button>
      <a className="ticket-contact" href={salon.phoneLink}>تماس با تینا <Icon name="phone" size={17} /></a>
    </div>
    {cancelled && <p className="receipt-save-hint">اگر نوبت را در تقویم گوشی ذخیره کرده‌ای، آن را از تقویم هم پاک کن.</p>}
    {notificationsDisabled && !cancelled && <p className="receipt-save-hint">فعلاً پیامک ارسال نمی‌شود؛ رسید نوبتت را نگه دار.</p>}
  </div>;
}
