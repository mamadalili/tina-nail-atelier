import Link from 'next/link';
import type { Metadata } from 'next';
import { salon } from '@/content/salon';

export const metadata: Metadata = { title: 'حریم خصوصی | تینا حسین‌زاده' };

export default function Privacy() {
  return <div className="legal-page wrap"><header><Link className="wordmark" href="/" dir="ltr">Tina.</Link></header><main><h1>حریم خصوصی</h1><p>برای هماهنگی وقت، فقط نام، شمارهٔ موبایل، خدمت و روز و بازهٔ دلخواهت را می‌پرسیم. توضیح اضافه اختیاری است؛ اطلاعات حساس یا پزشکی را در این فرم وارد نکن.</p><h2>فرستادن درخواست</h2><p>اگر درخواست از طریق واتس‌اپ فرستاده شود، متن واردشده در برنامهٔ واتس‌اپ باز می‌شود. ارسال آن با خود توست و اطلاعات مطابق تنظیمات همان پیام‌رسان پردازش می‌شود.</p><p>وقتی ثبت آنلاین سایت فعال باشد، درخواست برای هماهنگی با تینا در سرور نگهداری می‌شود و پیام هماهنگی می‌تواند از طریق شماره یا پیام‌رسان انتخابی انجام شود.</p><h2>پیگیری یا حذف اطلاعات</h2><p>برای اصلاح یا درخواست حذف اطلاعات وقتت، با شمارهٔ <a href={salon.phoneLink} dir="ltr">۰۹۳۵۳۱۵۵۸۵۲</a> تماس بگیر یا پیام بده.</p><Link className="button primary" href="/">بازگشت به خانه</Link></main></div>;
}
