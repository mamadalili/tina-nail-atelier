import { z } from 'zod';
import { elapsedMs, journeyId, maxJourneyMs, type MetricEvent } from './metric-event';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
const endpoint = basePath + (process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host' ? '/api/metrics.php' : '/api/booking-metrics');
const storageKey = 'tina-booking-measurement:v1:' + basePath;
const savedJourney = z.strictObject({
  id: journeyId, startedAt: z.number().int().positive(), firstSelection: elapsedMs.nullable(),
  received: z.boolean(), sent: z.number().int().min(0).max(3),
});
type Journey = z.infer<typeof savedJourney>;
let current: Journey | undefined;
const transmitting = new WeakSet<Journey>();

function restore() {
  try {
    const parsed = savedJourney.safeParse(JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null'));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

function save(journey: Journey) {
  if (journey !== current) return;
  try { window.sessionStorage.setItem(storageKey, JSON.stringify(journey)); } catch { /* Use memory if storage is disabled. */ }
}

function nextEvent(journey: Journey): MetricEvent | undefined {
  if (journey.sent === 0) return { id: journey.id, event: 'start' };
  if (journey.sent < 2 && journey.firstSelection !== null) return { id: journey.id, event: 'selected', elapsedMs: journey.firstSelection };
  if (journey.sent < 3 && journey.received) return { id: journey.id, event: 'receipt' };
}

async function transmit(journey: Journey, retries = 1) {
  if (transmitting.has(journey) || Date.now() - journey.startedAt > maxJourneyMs) return;
  transmitting.add(journey);
  try {
    for (let event = nextEvent(journey); event; event = nextEvent(journey)) {
      const response = await fetch(endpoint, {
        method: 'POST', mode: 'same-origin', credentials: 'omit', referrerPolicy: 'origin',
        cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
      });
      if (!response.ok) {
        if (response.status < 500) return;
        throw new Error('MEASUREMENT_UNAVAILABLE');
      }
      journey.sent = event.event === 'start' ? 1 : event.event === 'selected' ? 2 : 3;
      save(journey);
    }
  } catch {
    if (retries > 0) setTimeout(() => { void transmit(journey, retries - 1); }, 1500);
  } finally { transmitting.delete(journey); }
}

export function startBookingMeasurement() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!current || current.received || now < current.startedAt || now - current.startedAt > maxJourneyMs) {
    if (current?.received) void transmit(current);
    if (typeof crypto.randomUUID !== 'function') return;
    current = { id: crypto.randomUUID(), startedAt: now, firstSelection: null, received: false, sent: 0 };
    save(current);
  }
  void transmit(current);
}

export function markTimeSelected() {
  if (!current || current.received) return;
  const duration = Date.now() - current.startedAt;
  if (duration < 0 || duration > maxJourneyMs) return;
  current.firstSelection ??= duration;
  save(current);
  void transmit(current);
}

export function bookingMeasurementHeaders(): Record<string, string> {
  return current && !current.received && Date.now() - current.startedAt <= maxJourneyMs ? { 'X-Booking-Measurement': current.id } : {};
}

export function markBookingCompleted() {
  if (!current) return;
  current.received = true;
  save(current);
  void transmit(current);
}

// Resume events already observed in this tab if a navigation interrupted delivery.
if (typeof window !== 'undefined') {
  current = restore();
  if (current) void transmit(current);
}
