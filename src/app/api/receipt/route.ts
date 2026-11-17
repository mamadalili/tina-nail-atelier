import { receiptProofSchema } from '@/features/booking/receipt-model';
import { getDb } from '@/server/db';
import { findGuestReceipt } from '@/server/guest-receipts';
import { isAllowedOrigin } from '@/server/request-origin';
import { readBoundedJson } from '@/server/read-bounded-json';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const notFound = 'این رسید در دسترس نیست.';
const unavailable = 'دریافت وضعیت نوبت فعلاً ممکن نیست. دوباره تلاش کن.';

function error(status: number, message: string) {
  return Response.json({ message }, { status, headers });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers.get('origin'), request.headers.get('host'), process.env.SITE_URL, new URL(request.url).protocol)) {
    return error(403, 'درخواست از این نشانی مجاز نیست.');
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return error(415, 'فرمت درخواست معتبر نیست.');
  const body = await readBoundedJson(request, 512);
  if (!body.ok) return error(body.status, body.status === 413 ? 'حجم درخواست زیاد است.' : 'اطلاعات درخواست خوانده نشد.');
  const proof = receiptProofSchema.safeParse(body.data);
  if (!proof.success) return error(404, notFound);
  if (!process.env.DATABASE_URL) return error(503, unavailable);
  try {
    const receipt = await findGuestReceipt(getDb(), proof.data);
    return receipt ? Response.json({ receipt }, { headers }) : error(404, notFound);
  } catch { return error(503, unavailable); }
}
