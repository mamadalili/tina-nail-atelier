import { notFound } from 'next/navigation';
import { BookingReceipt } from '@/features/booking/BookingReceipt';
import { services } from '@/content/salon';
import { receiptFor } from '@/features/booking/receipt-model';
import { todayInTehran } from '@/lib/jalali';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'پیش‌نمایش رسید نوبت تینا', robots: { index: false, follow: false } };

export default function ReceiptPreview() {
  if (process.env.RECEIPT_PREVIEW_ENABLED !== 'true') notFound();
  const service = services[0];
  const receipt = receiptFor({ reference: 'TN-0000000000000000', status: 'CONFIRMED', name: 'مهمان نمونه', service: service.id, receiptServiceName: service.name, manicureType: null, jalaliDay: todayInTehran(new Date(Date.now() + 86400000)), period: '12-14', createdAt: new Date() });
  return <main className="receipt-preview-page"><BookingReceipt receipt={receipt} preview /></main>;
}
