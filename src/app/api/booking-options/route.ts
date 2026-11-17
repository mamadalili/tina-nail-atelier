import { NextResponse } from 'next/server';
import { staffMembers, periods } from '@/content/salon';
import { bookingWindow } from '@/features/booking/booking-options';
import { getDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  if (!process.env.DATABASE_URL || process.env.BOOKING_ENABLED !== 'true') {
    return NextResponse.json({ message: 'رزرو آنلاین هنوز فعال نیست.' }, { status: 503, headers });
  }
  try {
    const now = new Date();
    const { today, through } = bookingWindow(now);
    const booked = await getDb().appointmentRequest.findMany({
      where: {
        status: 'CONFIRMED', jalaliDay: { gte: today, lte: through },
        staff: { in: staffMembers.map(person => person.id) }, period: { in: periods.map(period => period.id) },
      },
      select: { staff: true, jalaliDay: true, period: true },
    });
    const taken = booked.map(({ staff, jalaliDay: date, period }) => ({ staff, date, period }));
    return NextResponse.json({ asOf: now.toISOString(), taken }, { headers });
  } catch {
    return NextResponse.json({ message: 'دریافت وقت‌های آزاد انجام نشد.' }, { status: 503, headers });
  }
}
