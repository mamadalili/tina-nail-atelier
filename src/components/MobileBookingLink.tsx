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

  return <a className="mobile-booking" href="#booking" hidden={!visible}>
    <Icon name="calendar" />درخواست وقت<span>با تقویم شمسی</span>
  </a>;
}
