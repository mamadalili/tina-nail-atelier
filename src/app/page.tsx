import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { ServiceIndex } from '@/features/services/ServiceIndex';
import { ColourStudy } from '@/features/colour/ColourStudy';
import { BookingForm } from '@/features/booking/BookingForm';
import { salon } from '@/content/salon';
import { todayInTehran } from '@/lib/jalali';
import { CinematicHero } from '@/features/home/CinematicHero';
import { Reveal } from '@/components/Reveal';
import { BookingFrame } from '@/components/BookingFrame';

export const dynamic = 'force-dynamic';

export default function Home() {
  const serverBooking = Boolean(process.env.DATABASE_URL && process.env.BOOKING_ENABLED === 'true');
  const now = new Date();
  return <>
    <a className="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <Header />
    <main id="main">
      <CinematicHero />

      <section id="booking" className="booking-section section" aria-labelledby="booking-title"><div className="wrap booking-layout"><div className="booking-intro"><span className="section-kicker" lang="en" dir="ltr">Your next appointment</span><h2 id="booking-title">یک وقت،<br /><em>فقط برای تو.</em></h2><p>مانیکور یا پدیکور، روز و ساعت دلخواهت را انتخاب کن.<br />چهار بازهٔ دوساعته، از ۱۰ صبح تا ۶ عصر.</p><p className="booking-note">این فرم درخواست وقت است. نوبتت پس از هماهنگی با تینا نهایی می‌شود.</p><a className="booking-phone" href={salon.phoneLink}><Icon name="phone" />اگر راحت‌تری، تماس بگیر<span dir="ltr">۰۹۳۵ ۳۱۵ ۵۸۵۲</span></a></div><BookingFrame><BookingForm today={todayInTehran(now)} initialNow={now.toISOString()} serverEnabled={serverBooking} /></BookingFrame></div></section>

      <section id="services" className="services-section wrap section" aria-labelledby="services-title">
        <Reveal><div className="section-heading"><div><span className="section-kicker" lang="en" dir="ltr">The atelier menu</span><h2 id="services-title">جزئیات کوچک.<br /><span className="subtle">انتخاب‌های شخصی.</span></h2></div><p>از یک مانیکور ساده تا انتخاب رنگ و طراحی ناخن؛<br />خدمتی که می‌خواهی را انتخاب کن.</p></div><ServiceIndex /></Reveal>
        <p className="service-footnote">برای تعرفه و جزئیات هر خدمت، قبل از نهایی‌شدن وقت در واتس‌اپ هماهنگ می‌کنیم.</p>
      </section>

      <section id="colour" className="colour-section" aria-labelledby="colour-heading">
        <div className="wrap"><Reveal><div className="section-heading colour-heading"><div><span className="section-kicker" lang="en" dir="ltr">The colour room</span><h2 id="colour-heading">امروز،<em> چه رنگی هستی؟</em></h2></div><p>رنگ و جلوه را عوض کن.<br />ببین کدام حال‌وهوا بیشتر شبیه توست.</p></div></Reveal><div className="colour-layout"><ColourStudy /><figure className="colour-photo"><Image src="/images/burgundy-colour-study.png" alt="کانسپت هنری ناخن زرشکی روی پارچهٔ ساتن مشکی کنار لاک" width={1536} height={1024} sizes="(max-width: 680px) 100vw, 45vw" quality={85} /><figcaption><span lang="en" dir="ltr">Burgundy, in focus.</span><span>تصویر هنری برای الهام از رنگ؛ نمونه‌کار مشتری نیست.</span></figcaption></figure></div></div>
      </section>

      <section id="about" className="about-section wrap section" aria-labelledby="about-title">
        <Reveal className="about-layout"><div className="about-title"><span className="section-kicker" lang="en" dir="ltr">A note from Tina</span><h2 id="about-title">سلیقهٔ تو،<br /><em>امضای من.</em></h2><span className="about-signature" lang="en" dir="ltr">Tina.</span></div><div className="about-copy"><p className="about-lead">سلام، من تینام.<br />اینجا از چیزی که تو دوست داری شروع می‌کنیم.</p><p>یک رنگ آرام یا یک انتخاب جسورانه؛ مهم این است که وقتی به دست‌هایت نگاه می‌کنی، انتخاب خودت را ببینی.</p><p>اگر عکسی از طرح دلخواهت داری یا هنوز بین چند مدل مرددی، قبل از وقتت برایم بفرست. دربارهٔ فرم، رنگ و جزئیاتش با هم صحبت می‌کنیم.</p><a className="text-link" href={`${salon.whatsapp}?text=${encodeURIComponent('سلام تینا، برای انتخاب مدل ناخن و هماهنگی وقت راهنمایی می‌خواهم.')}`} target="_blank" rel="noopener noreferrer">دربارهٔ مدل دلخواهم صحبت کنیم <Icon name="whatsapp" size={20} /></a></div></Reveal>
      </section>

      <section id="contact" className="contact-section section" aria-labelledby="contact-title"><div className="wrap contact-layout"><div><span className="section-kicker" lang="en" dir="ltr">Let’s make time.</span><h2 id="contact-title">وقتِ یک<br /><em>حالِ تازه.</em></h2></div><div className="contact-details"><p className="contact-address">ستارخان، حبیب‌الله شمالی</p><a className="contact-number" href={salon.phoneLink} dir="ltr">۰۹۳۵ ۳۱۵ ۵۸۵۲</a><div className="contact-methods"><a href={salon.phoneLink}><Icon name="phone" />تماس</a><a href={salon.smsLink}><Icon name="sms" />پیامک</a><a href={salon.whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />واتس‌اپ</a></div><p className="quiet-note">پیش از مراجعه، زمان و آدرس دقیق را هماهنگ کن.</p></div></div></section>
    </main>
    <footer className="site-footer wrap"><a className="footer-wordmark" href="/" lang="en" dir="ltr">Tina.</a><span>تینا حسین‌زاده · مانیکور و پدیکور</span><Link href="/privacy">حریم خصوصی</Link><a href="#main">بالای صفحه ↑</a></footer>
    <a className="mobile-booking booking-cta" href="#booking"><Icon name="calendar" />درخواست وقت<span>با تقویم شمسی</span></a>
  </>;
}
