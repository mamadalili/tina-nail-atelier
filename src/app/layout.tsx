import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './atelier.css';

export const metadata: Metadata = {
  title: 'تینا حسین‌زاده | ناخن، مانیکور و پدیکور',
  description: 'خدمات ناخن، مانیکور و پدیکور با تینا حسین‌زاده در ستارخان، حبیب‌الله شمالی. انتخاب روز شمسی و هماهنگی وقت با تماس یا واتس‌اپ.',
  robots: process.env.SITE_URL ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
