'use client';

import type { Ref } from 'react';
import { Icon } from '@/components/Icon';
import { salon, periods } from '@/content/salon';
import { faNumber, months } from '@/lib/jalali';
import type { BookingReceiptData } from './receipt-model';
import './receipt.css';

export function BookingReceipt({ receipt, preview = false, headingRef }: { receipt: BookingReceiptData; preview?: boolean; headingRef?: Ref<HTMLHeadingElement> }) {
  const [year, month, day] = receipt.date.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(new Date(receipt.startsAt));
  return <div className="receipt-experience" role="region" aria-label="رسید نوبت">
    {preview && <p className="preview-notice">پیش‌نمایش طرح رسید؛ این نوبت ثبت نشده است.</p>}
    <div className="receipt-intro"><span className="receipt-check"><Icon name="check" size={22} /></span><h3 ref={headingRef} tabIndex={-1}>{preview ? 'رسید وقتت این شکلی می‌شود.' : 'وقتت رزرو شد.'}</h3><p>{preview ? 'نمونهٔ نمایشی برای بررسی طراحی' : 'این وقت برای توست. رسیدت را نگه دار.'}</p></div>
    <article className="appointment-ticket" aria-label={preview ? 'نمونهٔ رسید نوبت' : 'رسید نهایی رزرو وقت'}>
      <header className="ticket-masthead"><div><span className="ticket-wordmark" lang="en" dir="ltr">Tina<span>.</span></span><span className="ticket-atelier">آتلیهٔ ناخن تینا</span></div><div className="ticket-status"><Icon name="check" size={16} />{preview ? 'نمونهٔ نمایشی' : 'نوبت قطعی'}<small lang="en" dir="ltr">APPOINTMENT PASS</small></div></header>
      <div className="ticket-body">
        <div className="ticket-guest"><span className="ticket-label">مهمان ما</span><strong>{receipt.name}</strong></div>
        <div className="ticket-when"><div className="ticket-date"><span className="ticket-label">{weekday}</span><strong>{faNumber(day)} <span>{months[month - 1]}</span></strong><small>{faNumber(year)}</small></div><div className="ticket-time"><span className="ticket-label">ساعت مراجعه</span><strong>{periods.find(item => item.id === receipt.period)!.label}</strong><small>به وقت تهران · ۲ ساعت</small></div></div>
        <div className="ticket-service"><span className="ticket-label">برای تو</span><strong>{receipt.service}{receipt.treatment && <span> / {receipt.treatment}</span>}</strong></div>
        <div className="ticket-location"><span className="ticket-label">آدرس</span><span>تهران، {salon.address}</span></div>
      </div>
      <footer className="ticket-stub"><div><span className="ticket-label">کد پیگیری نوبت</span><strong dir="ltr">{receipt.reference}</strong></div><span className="ticket-stub-mark" lang="en" dir="ltr">See you<br /><em>at Tina’s.</em></span></footer>
    </article>
    <div className="receipt-actions"><button type="button" className="button primary" onClick={() => window.print()}>چاپ یا ذخیرهٔ PDF</button><a href={salon.phoneLink}>تغییر وقت؟ تماس با تینا <Icon name="phone" size={17} /></a></div>
    <p className="receipt-save-hint">می‌توانی از همین رسید اسکرین‌شات بگیری.</p>
  </div>;
}
