'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const adminHref = process.env.NEXT_PUBLIC_BOOKING_ADAPTER === 'shared-host'
  ? '/tina-administrator/'
  : 'https://mrdalili.ir/tina-administrator/';

export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    function outside(event: Event) {
      const target = event.target;
      if (target instanceof Node && !menu.current?.contains(target) && !menuButton.current?.contains(target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    }
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', outside);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  return <header className="site-header wrap">
    <a className="wordmark" href="/" aria-label="تینا حسین‌زاده، خانه" dir="ltr">Tina<span>.</span><small>NAIL ATELIER</small></a>
    <nav ref={menu} id="site-navigation" aria-label="منوی اصلی" className={open ? 'main-nav is-open' : 'main-nav'}>
      {[['#services', 'خدمات'], ['#colour', 'رنگ و فرم'], ['#about', 'دربارهٔ تینا'], ['#contact', 'تماس']].map(([url, label]) => <a key={url} href={url} onClick={() => setOpen(false)}>{label}</a>)}
    </nav>
    <div className="header-actions">
      <a className="header-book" href="#appointment-form">رزرو نوبت <Icon name="calendar" size={18} /></a>
      <a className="header-admin" href={adminHref}>پنل مدیریت</a>
    </div>
    <button ref={menuButton} className="menu-toggle" type="button" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'بستن' : 'فهرست'}<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 8h16M4 16h16" />}</svg></button>
  </header>;
}
