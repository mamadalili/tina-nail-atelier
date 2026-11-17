'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayInTehran } from '../../lib/jalali';
import { availableTimes, parseBookingSnapshot, type OpenTimes } from './booking-options';
import { bookingApi } from './transport';

export type AvailabilityStatus = 'loading' | 'ready' | 'error' | 'offline';
type Snapshot = ReturnType<typeof parseBookingSnapshot>;
const emptyTimes: OpenTimes = { tina: [], sonia: [] };

export function useBookingTimes(enabled: boolean, initialNow: string) {
  const [result, setResult] = useState<{ snapshot?: Snapshot; status: AvailabilityStatus }>({ status: enabled ? 'loading' : 'offline' });
  const [clock, setClock] = useState(() => new Date(initialNow));
  const clockOffset = useRef(0);
  const active = useRef<AbortController | null>(null);
  const lastRequest = useRef(0);
  const now = useCallback(() => new Date(Date.now() + clockOffset.current), []);

  const refresh = useCallback(async (mode: 'explicit' | 'background' = 'explicit') => {
    if (!enabled) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const requestedAt = Date.now();
    lastRequest.current = requestedAt;
    setResult(current => mode === 'background' && current.status === 'ready' ? current : { status: 'loading' });
    setClock(now());
    const timeout = window.setTimeout(() => controller.abort('timeout'), 15000);
    try {
      const response = await fetch(bookingApi.options, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('AVAILABILITY_FAILED');
      const snapshot = parseBookingSnapshot(await response.json());
      if (active.current !== controller) return;
      if (controller.signal.aborted) throw new Error('AVAILABILITY_ABORTED');
      clockOffset.current = snapshot.clock.getTime() - (requestedAt + Date.now()) / 2;
      setClock(now());
      setResult({ status: 'ready', snapshot });
    } catch {
      if (active.current === controller && (!controller.signal.aborted || controller.signal.reason === 'timeout')) setResult({ status: 'error' });
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) active.current = null;
    }
  }, [enabled, now]);

  useEffect(() => {
    setClock(now());
    if (!enabled) return;
    void refresh();
    let timer: number;
    function scheduleMinute() {
      // Recheck at the start of each minute, including each Tehran slot boundary and midnight.
      timer = window.setTimeout(() => {
        if (!document.hidden) void refresh('background');
        scheduleMinute();
      }, 60010 - now().getTime() % 60000);
    }
    function onReturn() {
      if (!document.hidden && Date.now() - lastRequest.current > 1000) void refresh('background');
    }
    scheduleMinute();
    window.addEventListener('focus', onReturn);
    window.addEventListener('pageshow', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      active.current?.abort();
      active.current = null;
      window.clearTimeout(timer);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('pageshow', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [enabled, now, refresh]);

  const today = todayInTehran(clock);
  useEffect(() => {
    if (enabled && result.snapshot && result.snapshot.today !== today) void refresh();
  }, [enabled, result.snapshot, today, refresh]);
  const status: AvailabilityStatus = !enabled ? 'offline' : result.snapshot && result.snapshot.today !== today ? 'loading' : result.status;
  const open = useMemo(() => status === 'ready' && result.snapshot ? availableTimes(result.snapshot, clock) : emptyTimes, [status, result.snapshot, clock]);
  return { status, open, today, clock, now, refresh };
}
