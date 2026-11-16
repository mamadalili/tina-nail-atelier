import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './atelier.css';

export const metadata: Metadata = {
  title: 'آتلیهٔ ناخن تینا حسین‌زاده | خدمات دست و پا',
  description: 'خدمات دست و پا در آتلیهٔ ناخن تینا حسین‌زاده در ستارخان، حبیب‌الله شمالی. روز و ساعت دلخواهت را از تقویم تینا یا سونیا انتخاب کن.',
  robots: process.env.SITE_URL ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
