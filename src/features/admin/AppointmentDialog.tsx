'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { periods, services, staffMembers } from '@/content/salon';
import { readableDay, todayInTehran } from '@/lib/jalali';
import type { Appointment } from './model';
import { AdminDateFields } from './AdminDateFields';

type EditableFields = Pick<Appointment, 'name' | 'phone' | 'service' | 'date' | 'period' | 'note' | 'staff'>;
export type EditData = EditableFields & Pick<Appointment, 'manicureType'> & { consent: true };

export function AppointmentDialog({ appointment, mode, pending, error, onClose, onSave, onCancel }: {
  appointment: Appointment; mode: 'edit' | 'cancel'; pending: boolean; error: string;
  onClose: () => void; onSave: (data: EditData) => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<EditableFields>({ name: appointment.name, phone: appointment.phone, service: appointment.service, date: appointment.date, period: appointment.period, note: appointment.note, staff: appointment.staff });
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  const year = Number(data.date.slice(0, 4));
  const currentYear = Number(todayInTehran().slice(0, 4));
  const years = [...new Set([year, Number(appointment.date.slice(0, 4)), currentYear, currentYear + 1])].sort((a, b) => a - b);
  function change<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setData(current => ({ ...current, [key]: value }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (mode === 'cancel') return onCancel();
    const manicureType = data.service === 'manicure' && data.service === appointment.service ? appointment.manicureType : '';
    onSave({ ...data, manicureType, consent: true });
  }
  return <dialog ref={ref} className="admin-dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <form onSubmit={submit}>
      <header><div><span className="admin-eyebrow">{appointment.name}</span><h2 id="dialog-title">{mode === 'cancel' ? 'لغو این نوبت؟' : 'ویرایش نوبت'}</h2></div><button type="button" className="admin-icon" aria-label="بستن پنجره" disabled={pending} onClick={onClose}>×</button></header>
      {mode === 'cancel' ? <div className="admin-cancel-description"><p>نوبت <strong>{appointment.name}</strong> در {readableDay(appointment.date)}، ساعت {periods.find(item => item.id === appointment.period)?.label} لغو می‌شود و این ساعت دوباره قابل رزرو خواهد بود.</p><p>پیامک یا اعلان خودکار ارسال نمی‌شود؛ هماهنگی با مهمان را خودت انجام بده.</p></div> : <fieldset disabled={pending} className="admin-edit-fields">
        <label>وقت با<select value={data.staff} onChange={event => change('staff', event.target.value as EditData['staff'])}>{staffMembers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="admin-field-pair"><label>نام و نام خانوادگی<input value={data.name} maxLength={80} required onChange={event => change('name', event.target.value)} autoComplete="off" /></label><label>شمارهٔ موبایل<input value={data.phone} type="tel" dir="ltr" required maxLength={20} onChange={event => change('phone', event.target.value)} autoComplete="off" /></label></div>
        <label>خدمت<select value={data.service} onChange={event => change('service', event.target.value as EditData['service'])}>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <AdminDateFields title="روز نوبت، به تاریخ شمسی" date={data.date} years={years} onChange={value => change('date', value)} />
        <label>ساعت نوبت<select value={data.period} onChange={event => change('period', event.target.value as EditData['period'])}>{periods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>یادداشت<textarea value={data.note} rows={3} maxLength={500} onChange={event => change('note', event.target.value)} /></label><p className="admin-help">اگر ساعت جدید رزرو یا بسته باشد، تغییر ذخیره نمی‌شود. پیامک خودکار ارسال نمی‌شود.</p>
      </fieldset>}
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      <footer><button type="button" className="admin-button secondary" disabled={pending} onClick={onClose}>بازگشت</button><button className={`admin-button ${mode === 'cancel' ? 'danger' : 'primary'}`} disabled={pending}>{pending ? 'در حال ذخیره…' : mode === 'cancel' ? 'لغو نوبت' : 'ذخیرهٔ تغییرات'}</button></footer>
    </form>
  </dialog>;
}
