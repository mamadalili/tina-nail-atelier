import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import '@fontsource/cormorant-garamond/500.css';
export const metadata: Metadata = { title: 'مدیریت نوبت‌ها | تینا', robots: { index: false, follow: false }, other: { 'tina-admin-source': process.env.NEXT_PUBLIC_RELEASE_REVISION ?? 'local' } };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
