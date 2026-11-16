import Image from 'next/image';
import { Icon } from '@/components/Icon';

export function CinematicHero() {
  return <section className="hero cinematic-hero" aria-labelledby="hero-title">
    <div className="hero-inner wrap">
      <div className="hero-copy">
        <div className="hero-heading">
        <p className="hero-overline"><span aria-hidden="true" />آتلیهٔ ناخن</p>
        <h1 id="hero-title"><span className="sr-only">آتلیهٔ ناخن </span>تینا</h1>
        <p className="hero-statement">خدمات دست <em>و پا</em></p>
        </div>
        <div className="hero-details">
        <p className="hero-intro">تینا یا سونیا را انتخاب کن و ساعت‌های آزادش را ببین.</p>
        <div className="hero-actions"><a className="button primary" href="#appointment-form">رزرو نوبت <Icon name="arrow" size={20} /></a><a className="hero-service-link" href="#services">مشاهدهٔ خدمات</a></div>
        <p className="hero-location">تهران · ستارخان، حبیب‌الله شمالی</p>
        </div>
      </div>
      <figure className="hero-figure">
        <div className="portrait-frame"><Image className="hero-portrait" src="/images/tina-editorial-hands-v6.webp" alt="دست با ناخن‌های زرشکی روی چهره‌ای در سایه، با نور سینمایی" width={1122} height={1402} loading="eager" fetchPriority="high" sizes="(max-width: 680px) 100vw, (max-width: 1100px) 60vw, 58vw" quality={85} /><span className="portrait-light" aria-hidden="true" /></div>
      </figure>
    </div>
  </section>;
}
