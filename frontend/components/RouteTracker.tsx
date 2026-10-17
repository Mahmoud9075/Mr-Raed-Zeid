'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

export default function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    api('/analytics/visit', { method: 'POST', body: JSON.stringify({ path: pathname }) }).catch(() => {});
    api('/auth/presence', { method: 'POST', body: JSON.stringify({ path: pathname }) }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pathname) return;
      api('/auth/presence', { method: 'POST', body: JSON.stringify({ path: pathname }) }).catch(() => {});
    }, 60000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
