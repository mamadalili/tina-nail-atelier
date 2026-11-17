import { receiptProofSchema, savedReceiptSchema, type ReceiptProof } from './receipt-model';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
const receiptUrl = `${basePath}/api/${process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host' ? 'receipt.php' : 'receipt'}`;
// The shared host serves multiple projects on one origin. Only read this app's entries.
const prefix = `tina-booking-receipt:v1:${basePath}/:`;
export const receiptSavedEvent = 'tina-booking-receipt-saved';
export type StoredReceiptProof = ReceiptProof & { savedAt: number };
const temporary = new Map<string, StoredReceiptProof>();

export function rememberBookingReceipt(reference: string, requestKey: string) {
  if (typeof window === 'undefined' || !receiptProofSchema.safeParse({ reference, requestKey }).success) return false;
  const entry = { reference, requestKey, savedAt: Date.now() };
  let persistent = true;
  try {
    // Independent keys prevent simultaneous bookings in different tabs overwriting each other.
    window.localStorage.setItem(prefix + reference, JSON.stringify({ requestKey, savedAt: entry.savedAt }));
    temporary.delete(reference);
  } catch {
    persistent = false;
    temporary.set(reference, entry);
  }
  window.dispatchEvent(new CustomEvent(receiptSavedEvent, { detail: { reference, persistent } }));
  return persistent;
}

export function listBookingReceipts(): StoredReceiptProof[] {
  if (typeof window === 'undefined') return [];
  const entries = new Map(temporary);
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const value = JSON.parse(storage.getItem(key) ?? 'null');
        const proof = receiptProofSchema.safeParse({ reference: key.slice(prefix.length), requestKey: value?.requestKey });
        if (proof.success && Number.isSafeInteger(value.savedAt)) {
          entries.set(proof.data.reference, { ...proof.data, savedAt: value.savedAt });
        }
      } catch { /* Ignore a damaged entry and recover the rest. */ }
    }
  } catch { /* Storage can be disabled or unavailable in private browsing. */ }
  return [...entries.values()].sort((a, b) => b.savedAt - a.savedAt || a.reference.localeCompare(b.reference));
}

export function receiptStorageChanged(event: StorageEvent) {
  return event.key === null || event.key.startsWith(prefix);
}

export async function fetchBookingReceipt({ reference, requestKey }: ReceiptProof, signal: AbortSignal) {
  const response = await fetch(receiptUrl, {
    method: 'POST', mode: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, requestKey }),
  });
  if (!response.ok) throw new Error('RECEIPT_UNAVAILABLE');
  const receipt = savedReceiptSchema.parse((await response.json()).receipt);
  if (receipt.reference !== reference) throw new Error('RECEIPT_MISMATCH');
  return receipt;
}
