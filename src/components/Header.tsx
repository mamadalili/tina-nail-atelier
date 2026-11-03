'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus(); } }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  return <header className="site-header wrap">
    <a className="wordmark" href="/" aria-label="تینا حسین‌زاده، خانه" dir="ltr">Tina<span>.</span><small>NAIL ATELIER</small></a>
    <nav ref={menu} id="site-navigation" aria-label="منوی اصلی" className={open ? 'main-nav is-open' : 'main-nav'}>
      {[['#services', 'خدمات'], ['#colour', 'نگاه به رنگ'], ['#about', 'دربارهٔ تینا'], ['#contact', 'تماس']].map(([url, label]) => <a key={url} href={url} onClick={() => setOpen(false)}>{label}</a>)}
    </nav>
    <a className="header-book booking-cta" href="#booking">درخواست وقت <Icon name="calendar" size={18} /></a>
    <button ref={menuButton} className="menu-toggle" type="button" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'بستن' : 'فهرست'}<span aria-hidden="true">{open ? '×' : '☰'}</span></button>
  </header>;
}
