import { currentReceiptFor, type ReceiptProof } from '../features/booking/receipt-model';
import type { PrismaClient } from '../generated/prisma/client';

export async function findGuestReceipt(db: PrismaClient, { reference, requestKey }: ReceiptProof) {
  const record = await db.appointmentRequest.findUnique({
    where: { reference, idempotencyKey: requestKey, status: { in: ['CONFIRMED', 'CANCELLED'] } },
    select: {
      reference: true, status: true, name: true, service: true, receiptServiceName: true, manicureType: true,
      staff: true, jalaliDay: true, period: true, createdAt: true, updatedAt: true,
    },
  });
  return record ? currentReceiptFor(record) : null;
}
