import { NextResponse } from 'next/server';
import { staffMembers } from '@/content/salon';
import { bookingWindow } from '@/features/booking/booking-options';
import { getDb } from '@/server/db';
import { unavailableSlots } from '@/server/staff-schedules';

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
    const taken = await unavailableSlots(getDb(), today, through, staffMembers.map(person => person.id));
    return NextResponse.json({ asOf: now.toISOString(), taken }, { headers });
  } catch {
    return NextResponse.json({ message: 'دریافت وقت‌های آزاد انجام نشد.' }, { status: 503, headers });
  }
}
