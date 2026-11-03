import Image from 'next/image';
import { Icon } from '@/components/Icon';
import { salon } from '@/content/salon';

export function CinematicHero() {
  return <section className="hero cinematic-hero" aria-labelledby="hero-title">
    <div className="hero-inner wrap">
      <div className="hero-copy">
        <div className="hero-heading">
        <p className="hero-overline">استودیوی مانیکور و پدیکور</p>
        <h1 id="hero-title">تینا</h1>
        <p className="hero-statement">زیبایی،<br /><em>در جزئیاتِ تو.</em></p>
        </div>
        <div className="hero-details">
        <p className="hero-intro">رنگی که دوستش داری. فرمی که به دستت می‌آید.<br className="desktop-break" /> یک انتخاب کوچک، با حال‌وهوای خودت.</p>
        <div className="hero-actions"><a className="button primary booking-cta" href="#booking">وقتِ رسیدگی به خودت <Icon name="arrow" /></a><a className="hero-service-link" href="#services">خدمات من <span aria-hidden="true">↓</span></a></div>
        <div className="hero-location"><span>ستارخان، حبیب‌الله شمالی</span><a href={salon.phoneLink} dir="ltr">۰۹۳۵ ۳۱۵ ۵۸۵۲</a></div>
        </div>
      </div>
      <figure className="hero-figure">
        <div className="portrait-frame"><Image className="hero-portrait" src="/images/tina-owner-portrait-v5.webp" alt="پرترهٔ سیاه‌وسفید تینا با ناخن‌های زرشکی و دست کنار صورت" width={1122} height={1402} priority fetchPriority="high" sizes="(max-width: 680px) 280px, (min-width: 1700px) 400px, 350px" quality={85} /><span className="portrait-haze" aria-hidden="true" /><span className="portrait-light" aria-hidden="true" /></div>
      </figure>
    </div>
  </section>;
}
