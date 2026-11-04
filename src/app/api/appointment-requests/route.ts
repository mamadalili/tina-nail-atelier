import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { isAllowedOrigin } from '@/server/request-origin';
import { reserveAppointment, ReservationError } from '@/server/reservations';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.headers.get('origin'), request.headers.get('host'), process.env.SITE_URL, request.nextUrl.protocol)) return NextResponse.json({ message: 'درخواست از این نشانی مجاز نیست.' }, { status: 403, headers });
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ message: 'فرمت درخواست معتبر نیست.' }, { status: 415, headers });
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({ message: 'حجم درخواست زیاد است.' }, { status: 413, headers });
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') return NextResponse.json({ message: 'رزرو آنلاین هنوز فعال نیست. برای هماهنگی با تینا تماس بگیر.' }, { status: 503, headers });
  const key = request.headers.get('idempotency-key') ?? '';
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key)) return NextResponse.json({ message: 'شناسهٔ درخواست معتبر نیست؛ صفحه را دوباره باز کن.' }, { status: 400, headers });
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) return NextResponse.json({ message: 'حجم درخواست زیاد است.' }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ message: 'اطلاعات درخواست خوانده نشد.' }, { status: 400, headers }); }
  try {
    const result = await reserveAppointment(getDb(), key, body);
    return NextResponse.json({ receipt: result.receipt }, { status: result.repeated ? 200 : 201, headers });
  } catch (error) {
    if (error instanceof ReservationError) return NextResponse.json({ code: error.code, message: error.message, errors: error.errors }, { status: error.status, headers });
    return NextResponse.json({ message: 'ثبت نوبت انجام نشد. اطلاعاتت حفظ شده؛ دوباره تلاش کن یا با تینا تماس بگیر.' }, { status: 503, headers });
  }
}
