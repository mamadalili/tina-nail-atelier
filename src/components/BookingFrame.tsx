'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { faNumber } from '@/lib/jalali';
import { BookingReceipt } from '@/features/booking/BookingReceipt';
import { listBookingReceipts, receiptSavedEvent, receiptStorageChanged, type StoredReceiptProof } from '@/features/booking/receipt-access';

export function BookingFrame({ children }: { children: ReactNode }) {
  const [proofs, setProofs] = useState<StoredReceiptProof[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lookupVersion, setLookupVersion] = useState(0);
  const [issued, setIssued] = useState<{ reference: string; persistent: boolean } | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const formContent = useRef<HTMLDivElement>(null);
  const queuedService = useRef<string | null>(null);

  useEffect(() => {
    const entries = listBookingReceipts();
    setProofs(entries);
    setSelected(entries[0]?.reference ?? null);
    function saved(event: Event) {
      setProofs(listBookingReceipts());
      setIssued((event as CustomEvent<{ reference: string; persistent: boolean }>).detail);
      setSelected(null);
    }
    function synced(event: StorageEvent) {
      if (!receiptStorageChanged(event)) return;
      const savedEntries = listBookingReceipts();
      setProofs(savedEntries);
      setSelected(previous => previous && !savedEntries.some(entry => entry.reference === previous) ? savedEntries[0]?.reference ?? null : previous);
    }
    window.addEventListener(receiptSavedEvent, saved);
    window.addEventListener('storage', synced);
    return () => {
      window.removeEventListener(receiptSavedEvent, saved);
      window.removeEventListener('storage', synced);
    };
  }, []);

  const startBooking = useCallback(() => {
    if (issued) {
      setFormVersion(value => value + 1);
      setIssued(null);
    }
    setSelected(null);
    requestAnimationFrame(() => formContent.current?.querySelector<HTMLElement>('.form-heading h3')?.focus({ preventScroll: true }));
  }, [issued]);

  useEffect(() => {
    function selectService(event: Event) {
      if (issued) queuedService.current = (event as CustomEvent<string>).detail;
      startBooking();
    }
    function followBookingLink(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('a[href="#appointment-form"]')) startBooking();
    }
    window.addEventListener('select-service', selectService);
    document.addEventListener('click', followBookingLink);
    return () => {
      window.removeEventListener('select-service', selectService);
      document.removeEventListener('click', followBookingLink);
    };
  }, [issued, startBooking]);

  useEffect(() => {
    if (!issued && !selected && queuedService.current) {
      const service = queuedService.current;
      queuedService.current = null;
      window.dispatchEvent(new CustomEvent('select-service', { detail: service }));
    }
  }, [issued, selected]);

  const active = proofs.find(entry => entry.reference === selected);
  const reading = Boolean(issued || active);
  return <div className="booking-frame" id="appointment-form" role="region" aria-label="رزرو وقت" tabIndex={-1}>
    {proofs.length > 0 && <div className="receipt-navigation" role="group" aria-label="رزرو و رسیدهای این دستگاه">
      <button type="button" aria-pressed={!reading} onClick={startBooking}>رزرو نوبت جدید</button>
      <button type="button" aria-pressed={reading} onClick={() => {
        setSelected(active?.reference ?? issued?.reference ?? proofs[0].reference);
        setLookupVersion(value => value + 1);
      }}>رسیدهای من ({faNumber(proofs.length)})</button>
    </div>}
    {reading && proofs.length > 1 && <label className="receipt-picker">انتخاب رسید با کد پیگیری
      <select dir="ltr" value={active?.reference ?? issued?.reference} onChange={event => setSelected(event.target.value)}>
        {proofs.map(entry => <option value={entry.reference} key={entry.reference}>{entry.reference}</option>)}
      </select>
    </label>}
    {issued && !issued.persistent && <p className="receipt-storage-note">ذخیرهٔ رسید در این مرورگر ممکن نیست. پیش از بستن صفحه، رسیدت را به‌صورت PDF نگه دار.</p>}
    <div key={formVersion} ref={formContent} hidden={Boolean(active)}>{(!active || !issued) && children}</div>
    {active && <BookingReceipt key={`${active.reference}-${lookupVersion}`} proof={active} />}
  </div>;
}
