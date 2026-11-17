'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { periods } from '../../content/salon';
import { readableDay } from '../../lib/jalali';
import { fetchBookingReceipt, ReceiptFailure, type ReceiptChange } from './receipt-access';
import { receiptCalendar } from './receipt-calendar';
import type { BookingReceiptData, ReceiptProof, SavedBookingReceipt } from './receipt-model';

type Receipt = BookingReceiptData | SavedBookingReceipt;
type Editor = ReceiptChange['action'];
type Intent = 'read' | 'calendar' | Editor;
type State =
  | { status: 'loading' | 'error'; calendar: boolean; uncertain?: boolean }
  | { status: 'ready'; receipt: Receipt; checked: boolean; notice: string; editor: Editor | null; saving: boolean };

function upcoming(receipt: Receipt) {
  return receipt.status === 'CONFIRMED' && Date.parse(receipt.startsAt) > Date.now();
}

function describe(receipt: Receipt) {
  const label = periods.find(period => period.id === receipt.period)!.label;
  return receipt.status === 'CANCELLED' ? 'این نوبت اکنون لغو شده است.' : `نوبت ثبت‌شده برای ${readableDay(receipt.date)}، ساعت ${label} با ${receipt.staffName} است.`;
}

function saveCalendar(receipt: SavedBookingReceipt) {
  const file = receiptCalendar(receipt);
  if (!file) return 'این نوبت لغو شده و فایل تقویم دریافت نشد.';
  const link = document.createElement('a');
  link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(file)}`;
  link.download = `Tina-${receipt.reference}.ics`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  return 'فایل تقویم با آخرین زمان و مشخصات نوبت آماده شد.';
}

function changeProblem(error: unknown) {
  if (error instanceof ReceiptFailure) {
    if (error.code === 'SLOT_TAKEN') return 'زمان انتخابی دیگر آزاد نیست.';
    if (error.code === 'STALE_BOOKING') return 'این رسید از زمان باز شدن تغییر کرده بود.';
    if (error.code === 'TARGET_STARTED') return 'ساعت انتخابی شروع شده است. برای جابه‌جایی یک زمان دیگر انتخاب کن.';
    if (error.code === 'BOOKING_STARTED') return 'زمان شروع نوبت رسیده و دیگر نمی‌توان آن را تغییر داد.';
  }
  return 'نتیجهٔ درخواست تغییر از سرور دریافت نشد.';
}

export function useLiveReceipt(proof: ReceiptProof | undefined, initial: BookingReceiptData | undefined) {
  const [state, setState] = useState<State>(() => initial
    ? { status: 'ready', receipt: initial, checked: false, notice: '', editor: null, saving: false }
    : { status: 'loading', calendar: false });
  const active = useRef<{ controller: AbortController; writing: boolean } | null>(null);
  const recovery = useRef('');
  const started = useRef('');
  const reference = proof?.reference;
  const requestKey = proof?.requestKey;
  const initiallyIssued = Boolean(initial);

  const refresh = useCallback(async (intent: Intent = 'read') => {
    if (!reference || !requestKey || (document.hidden && !recovery.current)) return;
    if (active.current?.writing || (active.current && intent === 'read')) return;
    active.current?.controller.abort();
    const controller = new AbortController();
    active.current = { controller, writing: false };
    const calendar = intent === 'calendar';
    const wantsEditor = intent === 'reschedule' || intent === 'cancel';
    setState(current => wantsEditor && current.status === 'ready'
      ? { ...current, notice: '', saving: true }
      : { status: 'loading', calendar, uncertain: Boolean(recovery.current) });
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const receipt = await fetchBookingReceipt({ reference, requestKey }, controller.signal);
      if (active.current?.controller !== controller || controller.signal.aborted) return;
      let notice = recovery.current ? `${recovery.current} ${describe(receipt)}` : '';
      recovery.current = '';
      if (calendar) notice = saveCalendar(receipt);
      const editor = wantsEditor && upcoming(receipt) && receipt.version && receipt.startsAt !== started.current ? intent : null;
      if (wantsEditor && !editor) notice = `این نوبت اکنون قابل تغییر نیست. ${describe(receipt)}`;
      setState({ status: 'ready', receipt, checked: true, notice, editor, saving: false });
    } catch {
      if (active.current?.controller === controller) setState({ status: 'error', calendar, uncertain: Boolean(recovery.current) });
    } finally {
      window.clearTimeout(timer);
      if (active.current?.controller === controller) active.current = null;
    }
  }, [reference, requestKey]);

  async function change(input: ReceiptChange) {
    if (!reference || !requestKey || active.current || state.status !== 'ready' || !state.checked || state.editor !== input.action) return;
    const { receipt } = state;
    if (!receipt.version || !upcoming(receipt)) { void refresh(); return; }
    const version = receipt.version;
    const controller = new AbortController();
    active.current = { controller, writing: true };
    setState({ ...state, saving: true });
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const updated = await fetchBookingReceipt({ reference, requestKey }, controller.signal, { ...input, version });
      if (active.current?.controller !== controller) return;
      const applied = input.action === 'cancel' ? updated.status === 'CANCELLED'
        : updated.status === 'CONFIRMED' && updated.date === input.date && updated.period === input.period && updated.staff === receipt.staff;
      if (!applied || !updated.version || updated.version <= version) throw new Error('UNCONFIRMED_CHANGE');
      const notice = input.action === 'cancel' ? 'نوبتت لغو شد.' : `زمان جدید ثبت شد. ${describe(updated)}`;
      setState({ status: 'ready', receipt: updated, checked: true, notice, editor: null, saving: false });
    } catch (error) {
      if (active.current?.controller !== controller) return;
      if (error instanceof ReceiptFailure && error.code === 'BOOKING_STARTED') started.current = receipt.startsAt;
      recovery.current = changeProblem(error);
      // A lost response may follow a committed change. Read the receipt before permitting another write.
      active.current = null;
      await refresh();
    } finally {
      window.clearTimeout(timer);
      if (active.current?.controller === controller) active.current = null;
    }
  }

  useEffect(() => {
    if (!reference || !requestKey) return;
    function reset() { active.current?.controller.abort(); active.current = null; }
    function wake() { void refresh(); }
    function restored(event: PageTransitionEvent) { if (event.persisted) wake(); }
    function visibility() {
      if (!document.hidden) wake();
      else if (!active.current?.writing) { reset(); setState({ status: 'loading', calendar: false, uncertain: Boolean(recovery.current) }); }
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

  const startsAt = state.status === 'ready' && state.receipt.status === 'CONFIRMED' ? state.receipt.startsAt : null;
  useEffect(() => {
    if (!startsAt) return;
    const start = Date.parse(startsAt);
    if (Date.now() >= start) return;
    let timer: number;
    function check() {
      const remaining = start - Date.now();
      if (remaining > 0) timer = window.setTimeout(check, Math.min(remaining, 2_147_483_647));
      else setState(current => current.status === 'ready' && !current.saving ? { ...current, editor: null } : current);
    }
    check();
    return () => window.clearTimeout(timer);
  }, [startsAt]);

  const canEdit = state.status === 'ready' && state.checked && Boolean(state.receipt.version) && upcoming(state.receipt) && state.receipt.startsAt !== started.current;
  function closeEditor() {
    setState(current => current.status === 'ready' && !current.saving ? { ...current, editor: null } : current);
  }
  return { state, refresh, canEdit, change, closeEditor };
}
