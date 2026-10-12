'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type NavItem = { slug: string; title: string; path: string };
type UserInfo = { first_name?: string; role?: string };
type Lang = 'ar' | 'en';

const FALLBACK_LINKS: NavItem[] = [
  { slug: 'home', title: 'الرئيسية', path: '/' },
  { slug: 'about', title: 'عن المستر', path: '/#about' },
  { slug: 'quizzes', title: 'الاختبارات', path: '/quizzes' },
  { slug: 'moments', title: 'الأجواء', path: '/#moments' },
  { slug: 'students', title: 'طلابنا', path: '/#students' },
  { slug: 'honors', title: 'الإنجازات', path: '/#honors' },
  { slug: 'reviews', title: 'التقييمات', path: '/#reviews' },
  { slug: 'contact', title: 'تواصل', path: '/#contact' }
];

const EN_TITLES: Record<string, string> = {
  home: 'Home',
  about: 'About',
  quizzes: 'Quizzes',
  moments: 'Center Life',
  students: 'Students',
  honors: 'Honors',
  reviews: 'Reviews',
  contact: 'Contact'
};

function localizeLink(item: NavItem, lang: Lang): NavItem {
  if (lang === 'ar') return item;
  const anchor = item.path.startsWith('/#') ? item.path.slice(1) : '';
  return {
    ...item,
    title: EN_TITLES[item.slug] || item.title,
    path: anchor ? `/en${anchor}` : item.slug === 'home' ? '/en' : item.slug === 'quizzes' ? '/en#quizzes' : item.path
  };
}

export default function Header({ lang = 'ar' }: { lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<NavItem[]>(FALLBACK_LINKS);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [me, setMe] = useState<UserInfo | null>(null);
  const isEn = lang === 'en';

  useEffect(() => {
    api<NavItem[]>('/navigation').then((items) => items.length && setLinks(items)).catch(() => undefined);
    api<UserInfo>('/auth/me').then(setMe).catch(() => setMe(null));
    const saved = (localStorage.getItem('raed-theme') as 'light' | 'dark' | null) || 'light';
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const accountHref = useMemo(() => {
    if (!me) return '/login';
    return me.role === 'admin' || me.role === 'owner' ? '/admin' : '/student';
  }, [me]);

  const visibleLinks = useMemo(() => links.map((item) => localizeLink(item, lang)), [links, lang]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('raed-theme', next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <header className="site-header" dir={isEn ? 'ltr' : 'rtl'}>
      <nav className="nav-shell" aria-label={isEn ? 'Main navigation' : 'القائمة الرئيسية'}>
        <Link className="brand" href={isEn ? '/en' : '/'} aria-label="Mr. Raed Zeid home">
          <img src="/media/logo.png" alt="Mr. Raed Zeid" />
        </Link>

        <div className="nav-links nav-links-desktop">
          {visibleLinks.slice(0, 5).map((item) => (
            <Link key={item.slug} href={item.path}>{item.title}</Link>
          ))}
        </div>

        <div className="nav-actions header-actions">
          <Link className="header-search-btn" href="/student/search" aria-label={isEn ? 'Search' : 'بحث'} title={isEn ? 'Search' : 'بحث'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </Link>

          <button className="header-control" type="button" onClick={toggleTheme} aria-label={isEn ? 'Toggle theme' : 'تبديل المظهر'} title={isEn ? 'Theme' : 'المظهر'}>
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
          </button>

          <Link className="header-control lang-control" href={isEn ? '/' : '/en'} aria-label={isEn ? 'Arabic version' : 'English version'}>
            {isEn ? 'AR' : 'EN'}
          </Link>

          {!me ? (
            <>
              <Link className="btn btn-soft account-action hide-compact" href="/register">{isEn ? 'Create account' : 'حساب جديد'}</Link>
              <Link className="btn btn-dark account-action" href="/login">{isEn ? 'Sign in' : 'تسجيل الدخول'}</Link>
            </>
          ) : (
            <Link className="btn btn-dark account-action" href={accountHref}>
              {me.role === 'admin' || me.role === 'owner' ? (isEn ? 'Admin' : 'لوحة الإدارة') : (isEn ? 'My account' : 'حسابي')}
            </Link>
          )}

          <button className="menu-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={isEn ? 'Open menu' : 'فتح القائمة'}>
            <span /><span /><span />
          </button>
        </div>

        <div className={`mobile-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
          <div className="mobile-menu-head">
            <b>{isEn ? 'Menu' : 'القائمة'}</b>
            <button type="button" onClick={() => setOpen(false)} aria-label={isEn ? 'Close' : 'إغلاق'}>×</button>
          </div>
          <div className="mobile-menu-links">
            {visibleLinks.map((item) => (
              <Link key={item.slug} href={item.path} onClick={() => setOpen(false)}>{item.title}</Link>
            ))}
            <Link href="/student/search" onClick={() => setOpen(false)}>{isEn ? 'Search' : 'البحث'}</Link>
          </div>
          <div className="mobile-menu-actions">
            {!me && <Link className="btn" href="/register" onClick={() => setOpen(false)}>{isEn ? 'Create account' : 'حساب جديد'}</Link>}
            <Link className="btn btn-dark" href={accountHref} onClick={() => setOpen(false)}>{me ? (isEn ? 'My account' : 'حسابي') : (isEn ? 'Sign in' : 'تسجيل الدخول')}</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
