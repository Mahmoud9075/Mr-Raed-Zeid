'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MotionOrchestrator() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;

    const body = document.body;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('main .section, .footer'));

    body.classList.add('motion-ready');
    targets.forEach((target) => target.classList.add('motion-reveal'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return () => body.classList.remove('motion-ready');
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      targets.forEach((target) => {
        target.classList.remove('motion-reveal', 'is-visible');
      });
      body.classList.remove('motion-ready');
    };
  }, [pathname]);

  return null;
}
