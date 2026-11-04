'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export function MobileBookingLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const sections = document.querySelectorAll('.cinematic-hero, #booking');
    if (!sections.length) return;
    const inView = new Map<Element, boolean>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) inView.set(entry.target, entry.isIntersecting);
      setVisible(![...inView.values()].some(Boolean));
    });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return <a className="mobile-booking" href="#appointment-form" aria-label="انتخاب وقت با تینا" hidden={!visible}>
    <span className="dock-icon"><Icon name="calendar" size={22} /></span>
    <span className="dock-copy"><strong>وقتِ توئه.</strong><span>یک وقت، فقط برای تو</span></span>
    <span className="dock-action">انتخاب وقت<Icon name="arrow" size={18} /></span>
  </a>;
}
