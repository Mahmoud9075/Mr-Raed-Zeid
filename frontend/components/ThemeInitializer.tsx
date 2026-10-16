'use client';

import { useEffect } from 'react';

export default function ThemeInitializer() {
  useEffect(() => {
    const theme = window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  }, []);

  return null;
}
