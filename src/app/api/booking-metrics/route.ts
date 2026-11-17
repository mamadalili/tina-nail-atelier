import { metricEvent } from '@/features/booking/metric-event';
import { recordBookingMetric } from '@/server/booking-metrics';
import { getDb } from '@/server/db';
import { isAllowedOrigin } from '@/server/request-origin';
import { readBoundedJson } from '@/server/read-bounded-json';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const status = (code: number) => new Response(null, { status: code, headers });

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers.get('origin'), request.headers.get('host'), process.env.SITE_URL, new URL(request.url).protocol)) return status(403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return status(415);
  const body = await readBoundedJson(request, 256);
  if (!body.ok) return status(body.status);
  const event = metricEvent.safeParse(body.data);
  if (!event.success) return status(422);
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') return status(503);
  try { return status(await recordBookingMetric(getDb(), event.data) ? 204 : 429); }
  catch { return status(503); }
}
