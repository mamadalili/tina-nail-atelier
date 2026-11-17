import { salon } from '../../content/salon';
import type { BookingReceiptData, SavedBookingReceipt } from './receipt-model';

function calendarText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  let folded = '';
  let bytes = 0;
  for (const character of line) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      folded += '\r\n ';
      bytes = 1;
    }
    folded += character;
    bytes += width;
  }
  return folded;
}

function timestamp(instant: string) {
  return new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function receiptCalendar(receipt: BookingReceiptData | SavedBookingReceipt) {
  if (receipt.status === 'CANCELLED') return null;
  const description = [receipt.treatment, `کد پیگیری نوبت: ${receipt.reference}`].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tina Nail Atelier//Appointments//FA', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${receipt.reference}@mrdalili.ir`,
    `DTSTAMP:${timestamp('updatedAt' in receipt ? receipt.updatedAt : receipt.issuedAt)}`,
    `DTSTART:${timestamp(receipt.startsAt)}`, `DTEND:${timestamp(receipt.endsAt)}`,
    `SUMMARY:${calendarText(`${receipt.service} با ${receipt.staffName}`)}`,
    `LOCATION:${calendarText(`تهران، ${salon.address}`)}`,
    `DESCRIPTION:${calendarText(description)}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}
