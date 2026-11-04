import Link from 'next/link';
import type { Metadata } from 'next';
import { salon } from '@/content/salon';

export const metadata: Metadata = { title: 'حریم خصوصی | تینا حسین‌زاده' };

export default function Privacy() {
  const notificationsDisabled = process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host';
  return <div className="legal-page wrap"><header><Link className="wordmark" href="/" dir="ltr">Tina.</Link></header><main><h1>حریم خصوصی</h1><p>برای رزرو وقت، نام، شمارهٔ موبایل، خدمت، روز و ساعت مراجعه را می‌پرسیم. توضیح اضافه اختیاری است؛ اطلاعات حساس یا پزشکی را در این فرم وارد نکن.</p><h2>ثبت نوبت و اطلاع‌رسانی</h2><p>نوبت در سرور سایت ذخیره می‌شود و رسید آن داخل همین سایت نمایش داده می‌شود. فرم رزرو تو را به پیام‌رسان دیگری منتقل نمی‌کند.</p><p>{notificationsDisabled ? 'در این نسخه پیامک یا اعلان پیام‌رسان ارسال نمی‌شود. نام، شماره و جزئیات نوبت برای رسیدگی به رزرو در سرور نگه‌داری می‌شود؛ این اطلاعات در فهرست عمومی سایت نمایش داده نمی‌شود.' : 'برای اطلاع‌رسانی نوبت، نام، شمارهٔ تماس، خدمت و زمان مراجعه از طریق سرویس پیامک و اعلان خصوصی مدیر پردازش می‌شود. دسترسی به این اطلاعات برای رسیدگی به نوبت توست.'}</p><h2>پیگیری یا حذف اطلاعات</h2><p>برای اصلاح یا درخواست حذف اطلاعات وقتت، با شمارهٔ <a href={salon.phoneLink} dir="ltr">۰۹۳۵۳۱۵۵۸۵۲</a> تماس بگیر یا پیام بده.</p><Link className="button primary" href="/">بازگشت به خانه</Link></main></div>;
}
