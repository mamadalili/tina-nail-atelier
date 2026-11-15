import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { isAllowedDay, todayInTehran } from '@/lib/jalali';
import { staffMembers } from '@/content/salon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const day = request.nextUrl.searchParams.get('date') ?? '';
  const staff = request.nextUrl.searchParams.get('staff') ?? 'tina';
  if (!staffMembers.some(item => item.id === staff)) return NextResponse.json({ message: 'تینا یا سونیا را انتخاب کن.' }, { status: 400, headers });
  if (!isAllowedDay(day, todayInTehran())) return NextResponse.json({ message: 'روز معتبر انتخاب کن.' }, { status: 400, headers });
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') return NextResponse.json({ message: 'رزرو آنلاین هنوز فعال نیست.' }, { status: 503, headers });
  try {
    const bookings = await getDb().appointmentRequest.findMany({ where: { staff, jalaliDay: day, status: 'CONFIRMED' }, select: { period: true } });
    return NextResponse.json({ date: day, taken: bookings.map(booking => booking.period) }, { headers });
  } catch { return NextResponse.json({ message: 'دریافت ساعت‌ها انجام نشد؛ دوباره تلاش کن.' }, { status: 503, headers }); }
}
