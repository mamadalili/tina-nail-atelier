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
import { MobileBookingLink } from '@/components/MobileBookingLink';

export const dynamic = 'force-dynamic';

export default function Home() {
  const serverBooking = Boolean(process.env.DATABASE_URL && process.env.BOOKING_ENABLED === 'true');
  const now = new Date();
  return <>
    <a className="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <Header />
    <main id="main">
      <CinematicHero />

      <section id="booking" className="booking-section section" aria-labelledby="booking-title">
        <div className="wrap booking-layout">
          <div className="booking-intro">
            <div><span className="section-kicker" lang="en" dir="ltr">A little time for you.</span>
            <h2 id="booking-title">یک وقت، <em>فقط برای تو.</em></h2>
            <p>خدمت، روز و ساعت خالی را انتخاب کن؛ نوبتت را رزرو کن و رسیدش را همین‌جا بگیر.</p></div>
            <a className="booking-phone" href={salon.phoneLink}><span className="booking-phone-icon"><Icon name="phone" size={20} /></span><span>هماهنگی تلفنی<strong dir="ltr">۰۹۳۵ ۳۱۵ ۵۸۵۲</strong></span></a>
          </div>
          <BookingFrame><BookingForm today={todayInTehran(now)} initialNow={now.toISOString()} serverEnabled={serverBooking} /></BookingFrame>
        </div>
      </section>

      <section id="services" className="services-section wrap section" aria-labelledby="services-title">
        <Reveal><div className="section-heading"><div><span className="section-kicker" lang="en" dir="ltr">The atelier menu</span><h2 id="services-title">جزئیات کوچک.<br /><span className="subtle">انتخاب‌های شخصی.</span></h2></div><p>از یک مانیکور ساده تا انتخاب رنگ و طراحی ناخن؛<br />خدمتی که می‌خواهی را انتخاب کن.</p></div><ServiceIndex /></Reveal>
        <p className="service-footnote">برای پرسیدن تعرفه یا جزئیات طراحی، پیش از رزرو با تینا تماس بگیر.</p>
      </section>

      <section id="colour" className="colour-section" aria-labelledby="colour-heading">
        <div className="wrap"><Reveal><div className="section-heading colour-heading"><div><span className="section-kicker" lang="en" dir="ltr">The colour room</span><h2 id="colour-heading">امروز،<em> چه رنگی هستی؟</em></h2></div><p>رنگ، فرم و جلوه را امتحان کن.<br />انتخاب تو، شروع گفت‌وگوی ماست.</p></div></Reveal><div className="colour-layout"><ColourStudy /><figure className="colour-photo"><Image src="/images/burgundy-colour-study.webp" alt="کانسپت هنری ناخن زرشکی روی پارچهٔ ساتن مشکی کنار لاک" width={1536} height={1024} sizes="(max-width: 680px) 100vw, (max-width: 900px) 55vw, 45vw" quality={85} /><figcaption><span lang="en" dir="ltr">Burgundy, in focus.</span><span>تصویر هنری برای الهام از رنگ؛ نمونه‌کار مشتری نیست.</span></figcaption></figure></div></div>
      </section>

      <section id="about" className="about-section wrap section" aria-labelledby="about-title">
        <Reveal className="about-layout"><div className="about-title"><span className="section-kicker" lang="en" dir="ltr">A note from Tina</span><h2 id="about-title">سلیقهٔ تو،<br /><em>امضای من.</em></h2><span className="about-signature" lang="en" dir="ltr">Tina.</span></div><div className="about-copy"><p className="about-lead">سلام، من تینام.<br />اینجا از چیزی که تو دوست داری شروع می‌کنیم.</p><p>یک رنگ آرام یا یک انتخاب جسورانه؛ مهم این است که وقتی به دست‌هایت نگاه می‌کنی، انتخاب خودت را ببینی.</p><p>اگر عکسی از طرح دلخواهت داری یا هنوز بین چند مدل مرددی، قبل از وقتت برایم بفرست. دربارهٔ فرم، رنگ و جزئیاتش با هم صحبت می‌کنیم.</p><a className="text-link" href={`${salon.whatsapp}?text=${encodeURIComponent('سلام تینا، برای انتخاب مدل ناخن و هماهنگی وقت راهنمایی می‌خواهم.')}`} target="_blank" rel="noopener noreferrer">دربارهٔ مدل دلخواهم صحبت کنیم <Icon name="whatsapp" size={20} /></a></div></Reveal>
      </section>

      <section id="contact" className="contact-section section" aria-labelledby="contact-title"><div className="wrap contact-layout"><div><span className="section-kicker" lang="en" dir="ltr">Let’s make time.</span><h2 id="contact-title">وقتِ یک<br /><em>حالِ تازه.</em></h2></div><div className="contact-details"><p className="contact-address">ستارخان، حبیب‌الله شمالی</p><a className="contact-number" href={salon.phoneLink} dir="ltr">۰۹۳۵ ۳۱۵ ۵۸۵۲</a><div className="contact-methods"><a href={salon.phoneLink}><Icon name="phone" />تماس</a><a href={salon.smsLink}><Icon name="sms" />پیامک</a><a href={salon.whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />واتس‌اپ</a></div><p className="quiet-note">پیش از مراجعه، زمان و آدرس دقیق را هماهنگ کن.</p></div></div></section>
    </main>
    <footer className="site-footer wrap">
      <a className="footer-wordmark" href="/" lang="en" dir="ltr">Tina.</a>
      <div className="footer-identity"><strong>تینا · خدمات ناخن</strong><ul aria-label="خدمات تینا"><li>آرایشی</li><li>بهداشتی</li><li>پدیکور</li><li>مانیکور</li></ul></div>
      <Link href="/privacy">حریم خصوصی</Link><a href="#main">بالای صفحه ↑</a>
    </footer>
    <MobileBookingLink />
  </>;
}
