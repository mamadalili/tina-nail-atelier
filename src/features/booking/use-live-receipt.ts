'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBookingReceipt } from './receipt-access';
import { receiptCalendar } from './receipt-calendar';
import type { BookingReceiptData, ReceiptProof, SavedBookingReceipt } from './receipt-model';

type State =
  | { status: 'loading' | 'error'; calendar: boolean }
  | { status: 'ready'; receipt: BookingReceiptData | SavedBookingReceipt; checked: boolean; notice: string };

export function useLiveReceipt(proof: ReceiptProof | undefined, initial: BookingReceiptData | undefined) {
  const [state, setState] = useState<State>(() => initial
    ? { status: 'ready', receipt: initial, checked: false, notice: '' }
    : { status: 'loading', calendar: false });
  const active = useRef<AbortController | null>(null);
  const reference = proof?.reference;
  const requestKey = proof?.requestKey;
  const initiallyIssued = Boolean(initial);

  const refresh = useCallback(async (calendar = false) => {
    if (!reference || !requestKey || document.visibilityState === 'hidden') return;
    if (active.current && !calendar) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'loading', calendar });
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const receipt = await fetchBookingReceipt({ reference, requestKey }, controller.signal);
      if (active.current !== controller || controller.signal.aborted) return;
      let notice = '';
      if (calendar) {
        const file = receiptCalendar(receipt);
        if (file) {
          const link = document.createElement('a');
          link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(file)}`;
          link.download = `Tina-${reference}.ics`;
          link.hidden = true;
          document.body.append(link);
          link.click();
          link.remove();
          notice = 'فایل تقویم با آخرین زمان و مشخصات نوبت آماده شد.';
        } else {
          notice = 'این نوبت لغو شده و فایل تقویم دریافت نشد.';
        }
      }
      setState({ status: 'ready', receipt, checked: true, notice });
    } catch {
      if (active.current === controller) setState({ status: 'error', calendar });
    } finally {
      window.clearTimeout(timer);
      if (active.current === controller) active.current = null;
    }
  }, [reference, requestKey]);

  useEffect(() => {
    if (!reference || !requestKey) return;
    function reset() { active.current?.abort(); active.current = null; }
    function wake() { void refresh(); }
    function restored(event: PageTransitionEvent) { if (event.persisted) wake(); }
    function visibility() {
      if (document.visibilityState === 'visible') wake();
      else { reset(); setState({ status: 'loading', calendar: false }); }
    }
    if (!initiallyIssued) wake();
    window.addEventListener('pageshow', restored);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    window.addEventListener('offline', wake);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      reset();
      window.removeEventListener('pageshow', restored);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', wake);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [initiallyIssued, reference, requestKey, refresh]);
  return { state, refresh };
}
