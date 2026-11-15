import type { CSSProperties } from 'react';

export function Icon({ name, size = 22, style }: { name: 'arrow' | 'phone' | 'whatsapp' | 'sms' | 'plus' | 'close' | 'check' | 'calendar' | 'chevron'; size?: number; style?: CSSProperties }) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: <><path d="M19 12H5m6-6-6 6 6 6" /></>,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z" />,
    whatsapp: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.1-4.6A8.5 8.5 0 1 1 20.5 11.5Z" /><path d="m8 7 1.5 3-1 1a8 8 0 0 0 4 4l1-1 3 1.5c-1 4-7 1-9-3s-1-5.5.5-5.5Z" /></>,
    sms: <><path d="M3 4h18v13H9l-6 4V4Z" /><path d="M7 9h10M7 13h7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6m10-6v6M3 11h18m-13 4h3" /></>,
    chevron: <path d="m14 6-6 6 6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
