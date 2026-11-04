import type { ReactNode } from 'react';

export function BookingFrame({ children }: { children: ReactNode }) {
  return <div className="booking-frame" id="appointment-form" role="region" aria-label="رزرو وقت" tabIndex={-1}>{children}</div>;
}
