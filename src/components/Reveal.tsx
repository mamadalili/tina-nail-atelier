'use client';

import { useEffect, useRef } from 'react';

export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = node.current;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const rect = element.getBoundingClientRect();
    if (rect.top < innerHeight) return;
    element.dataset.reveal = 'waiting';
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { element.dataset.reveal = 'visible'; observer.disconnect(); }
    }, { threshold: .08 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={node} className={`reveal ${className}`}>{children}</div>;
}
