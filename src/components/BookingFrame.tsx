import type { ReactNode } from 'react';

export function BookingFrame({ children }: { children: ReactNode }) {
  return <div className="booking-frame">
    {children}
    <svg className="booking-rim" aria-hidden="true" focusable="false" width="100%" height="100%">
      <defs><linearGradient id="booking-rim-light"><stop stopColor="#a74c65" /><stop offset=".5" stopColor="#fff0f4" /><stop offset="1" stopColor="#a74c65" /></linearGradient></defs>
      <rect x="1" y="1" rx="9" pathLength="100" fill="none" stroke="url(#booking-rim-light)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 86" />
    </svg>
  </div>;
}
