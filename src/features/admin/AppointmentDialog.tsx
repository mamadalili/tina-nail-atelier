'use client';

import { useEffect, useRef, useState } from 'react';
import { manicureOptions, periods, services } from '@/content/salon';
import { faNumber, monthCells, months, readableDay, todayInTehran } from '@/lib/jalali';
import { validDateChange, type Appointment } from './model';

export type EditData = Pick<Appointment, 'name' | 'phone' | 'service' | 'manicureType' | 'date' | 'period' | 'note'> & { consent: true };

export function AppointmentDialog({ appointment, mode, pending, error, onClose, onSave, onCancel }: {
  appointment: Appointment; mode: 'edit' | 'cancel'; pending: boolean; error: string;
  onClose: () => void; onSave: (data: EditData) => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<EditData>({ name: appointment.name, phone: appointment.phone, service: appointment.service, manicureType: appointment.manicureType, date: appointment.date, period: appointment.period, note: appointment.note, consent: true });
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  const [year, month, day] = data.date.split('-').map(Number);
  const currentYear = Number(todayInTehran().slice(0, 4));
  const years = [...new Set([year, Number(appointment.date.slice(0, 4)), currentYear, currentYear + 1])].sort((a, b) => a - b);
  function change<K extends keyof EditData>(key: K, value: EditData[K]) { setData(current => ({ ...current, [key]: value, ...(key === 'service' && value === 'pedicure' ? { manicureType: '' as const } : {}) })); }
  return <dialog ref={ref} className="admin-dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (!pending) mode === 'cancel' ? onCancel() : onSave(data); }}>
      <header><div><span className="admin-eyebrow">{appointment.name}</span><h2 id="dialog-title">{mode === 'cancel' ? 'لغو این نوبت؟' : 'ویرایش نوبت'}</h2></div><button type="button" className="admin-icon" aria-label="بستن پنجره" disabled={pending} onClick={onClose}>×</button></header>
      {mode === 'cancel' ? <div className="admin-cancel-description"><p>نوبت <strong>{appointment.name}</strong> در {readableDay(appointment.date)}، ساعت {periods.find(item => item.id === appointment.period)?.label} لغو می‌شود و این ساعت دوباره قابل رزرو خواهد بود.</p><p>پیامک یا اعلان خودکار ارسال نمی‌شود؛ هماهنگی با مهمان را خودت انجام بده.</p></div> : <fieldset disabled={pending} className="admin-edit-fields">
        <div className="admin-field-pair"><label>نام و نام خانوادگی<input value={data.name} maxLength={80} required onChange={event => change('name', event.target.value)} autoComplete="off" /></label><label>شمارهٔ موبایل<input value={data.phone} type="tel" dir="ltr" required maxLength={20} onChange={event => change('phone', event.target.value)} autoComplete="off" /></label></div>
        <div className="admin-field-pair"><label>خدمت<select value={data.service} onChange={event => change('service', event.target.value as EditData['service'])}>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{data.service === 'manicure' && <label>نوع مانیکور<select value={data.manicureType} onChange={event => change('manicureType', event.target.value as EditData['manicureType'])}><option value="">انتخاب کن</option>{manicureOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div>
        <fieldset className="admin-date-fields"><legend>روز نوبت، به تاریخ شمسی</legend><label>روز<select value={day} onChange={event => change('date', validDateChange(data.date, 'day', Number(event.target.value)))}>{monthCells(year, month).filter((value): value is number => value !== null).map(value => <option key={value} value={value}>{faNumber(value)}</option>)}</select></label><label>ماه<select value={month} onChange={event => change('date', validDateChange(data.date, 'month', Number(event.target.value)))}>{months.map((value, i) => <option key={value} value={i + 1}>{value}</option>)}</select></label><label>سال<select value={year} onChange={event => change('date', validDateChange(data.date, 'year', Number(event.target.value)))}>{years.map(value => <option key={value} value={value}>{faNumber(value)}</option>)}</select></label></fieldset>
        <label>ساعت نوبت<select value={data.period} onChange={event => change('period', event.target.value as EditData['period'])}>{periods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>یادداشت<textarea value={data.note} rows={3} maxLength={500} onChange={event => change('note', event.target.value)} /></label><p className="admin-help">اگر ساعت جدید رزرو یا بسته باشد، تغییر ذخیره نمی‌شود. پیامک خودکار ارسال نمی‌شود.</p>
      </fieldset>}
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      <footer><button type="button" className="admin-button secondary" disabled={pending} onClick={onClose}>بازگشت</button><button className={`admin-button ${mode === 'cancel' ? 'danger' : 'primary'}`} disabled={pending}>{pending ? 'در حال ذخیره…' : mode === 'cancel' ? 'لغو نوبت' : 'ذخیرهٔ تغییرات'}</button></footer>
    </form>
  </dialog>;
}
