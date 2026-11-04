import Image from 'next/image';
import { Icon } from '@/components/Icon';

export function CinematicHero() {
  return <section className="hero cinematic-hero" aria-labelledby="hero-title">
    <div className="hero-inner wrap">
      <div className="hero-copy">
        <div className="hero-heading">
        <p className="hero-overline"><span aria-hidden="true" />آتلیهٔ ناخن تینا</p>
        <h1 id="hero-title">تینا</h1>
        <p className="hero-statement">هنرِ جزئیات.<br /><em>به سلیقهٔ تو.</em></p>
        </div>
        <div className="hero-details">
        <p className="hero-intro">مانیکور و پدیکور، با توجه به چیزی که تو دوست داری.<br className="desktop-break" /> از فرم و رنگ تا آخرین جزئیات.</p>
        <div className="hero-actions"><a className="button primary" href="#booking">درخواست وقت <Icon name="arrow" size={20} /></a><a className="hero-service-link" href="#services">کشف خدمات <span aria-hidden="true">↙</span></a></div>
        <p className="hero-location">تهران · ستارخان، حبیب‌الله شمالی</p>
        </div>
      </div>
      <figure className="hero-figure">
        <div className="portrait-frame"><Image className="hero-portrait" src="/images/tina-editorial-hands-v6.webp" alt="تصویر مفهومی آتلیه؛ دست با ناخن‌های زرشکی روی چهره‌ای در سایه، با نور سینمایی" width={1122} height={1402} loading="eager" fetchPriority="high" sizes="(max-width: 680px) 100vw, (max-width: 1100px) 60vw, 58vw" quality={85} /><span className="portrait-light" aria-hidden="true" /></div>
        <figcaption><span className="hero-art-title" lang="en" dir="ltr">The art<br />of detail.</span><span className="hero-art-note">تصویر مفهومی آتلیه</span></figcaption>
      </figure>
    </div>
    <div className="hero-rail wrap"><span lang="en" dir="ltr">TINA — NAIL ATELIER</span><span>مانیکور <i aria-hidden="true">/</i> پدیکور</span><a href="#booking">وقتی برای خودت <span aria-hidden="true">↓</span></a></div>
  </section>;
}
