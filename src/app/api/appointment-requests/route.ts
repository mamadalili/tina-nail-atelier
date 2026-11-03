import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateSubmission } from '@/features/booking/model';
import { toGregorianDay } from '@/lib/jalali';
import { getDb } from '@/server/db';
import { isAllowedOrigin } from '@/server/request-origin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin, request.headers.get('host'), process.env.SITE_URL, request.nextUrl.protocol)) return NextResponse.json({ message: 'درخواست از این نشانی مجاز نیست.' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ message: 'فرمت درخواست معتبر نیست.' }, { status: 415 });
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({ message: 'حجم درخواست زیاد است.' }, { status: 413 });
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') return NextResponse.json({ message: 'برای هماهنگی وقت، درخواستت را در واتس‌اپ بفرست.' }, { status: 503 });
  const key = request.headers.get('idempotency-key') ?? '';
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key)) return NextResponse.json({ message: 'شناسهٔ درخواست معتبر نیست؛ صفحه را دوباره باز کن.' }, { status: 400 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) return NextResponse.json({ message: 'حجم درخواست زیاد است.' }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ message: 'اطلاعات درخواست خوانده نشد.' }, { status: 400 }); }
  const validation = validateSubmission(body);
  if (!validation.success) return NextResponse.json({ errors: validation.errors }, { status: 422 });
  const data = validation.data;
  const payloadHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  try {
    const db = getDb();
    const previous = await db.appointmentRequest.findUnique({ where: { idempotencyKey: key }, select: { id: true, payloadHash: true } });
    if (previous && previous.payloadHash !== payloadHash) return NextResponse.json({ message: 'این شناسه برای اطلاعات دیگری استفاده شده؛ دوباره تلاش کن.' }, { status: 409 });
    let id = previous?.id;
    if (!id) {
      const recent = await db.appointmentRequest.count({ where: { phone: data.phone, createdAt: { gt: new Date(Date.now() - 3600000) } } });
      if (recent >= 3) return NextResponse.json({ message: 'چند درخواست از این شماره ثبت شده؛ برای پیگیری در واتس‌اپ پیام بده.' }, { status: 429 });
      const created = await db.appointmentRequest.create({ data: {
        idempotencyKey: key, payloadHash, name: data.name, phone: data.phone, service: data.service, manicureType: data.manicureType || null,
        preferredDay: new Date(`${toGregorianDay(data.date)}T00:00:00Z`), jalaliDay: data.date, period: data.period, note: data.note,
        outbox: { create: { channel: 'TELEGRAM', kind: 'REQUESTED' } }
      }, select: { id: true } });
      id = created.id;
    }
    return NextResponse.json({ reference: id.slice(0, 8).toUpperCase(), status: 'PENDING' }, { status: previous ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const repeated = await getDb().appointmentRequest.findUnique({ where: { idempotencyKey: key }, select: { id: true, payloadHash: true } }).catch(() => null);
      if (repeated?.payloadHash === payloadHash) return NextResponse.json({ reference: repeated.id.slice(0, 8).toUpperCase(), status: 'PENDING' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ message: 'ثبت درخواست فعلاً ممکن نیست. اطلاعاتت را در واتس‌اپ برای تینا بفرست.' }, { status: 503 });
  }
}
