import type { ReactNode } from 'react';

export function BookingFrame({ children }: { children: ReactNode }) {
  return <div className="booking-frame">{children}</div>;
}
