import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { isAllowedDay, todayInTehran } from '@/lib/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const day = request.nextUrl.searchParams.get('date') ?? '';
  if (!isAllowedDay(day, todayInTehran())) return NextResponse.json({ message: 'روز معتبر انتخاب کن.' }, { status: 400, headers });
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') return NextResponse.json({ message: 'رزرو آنلاین هنوز فعال نیست.' }, { status: 503, headers });
  try {
    const bookings = await getDb().appointmentRequest.findMany({ where: { jalaliDay: day, status: 'CONFIRMED' }, select: { period: true } });
    return NextResponse.json({ date: day, taken: bookings.map(booking => booking.period) }, { headers });
  } catch { return NextResponse.json({ message: 'دریافت ساعت‌ها انجام نشد؛ دوباره تلاش کن.' }, { status: 503, headers }); }
}
