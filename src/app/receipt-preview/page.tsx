import { notFound } from 'next/navigation';
import { BookingReceipt } from '@/features/booking/BookingReceipt';
import { receiptFor } from '@/features/booking/receipt-model';
import { todayInTehran } from '@/lib/jalali';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'پیش‌نمایش رسید نوبت تینا', robots: { index: false, follow: false } };

export default function ReceiptPreview() {
  if (process.env.RECEIPT_PREVIEW_ENABLED !== 'true') notFound();
  const receipt = receiptFor({ reference: 'TN-0000000000000000', status: 'CONFIRMED', name: 'مهمان نمونه', service: 'manicure', manicureType: 'gel', jalaliDay: todayInTehran(new Date(Date.now() + 86400000)), period: '12-14', createdAt: new Date() });
  return <main className="receipt-preview-page"><BookingReceipt receipt={receipt} preview /></main>;
}
