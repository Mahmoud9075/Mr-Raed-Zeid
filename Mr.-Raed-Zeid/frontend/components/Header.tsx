'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type NavItem = { slug: string; title: string; path: string };

type UserInfo = { first_name?: string; role?: string };

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

export default function Header() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<NavItem[]>(FALLBACK_LINKS);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [me, setMe] = useState<UserInfo | null>(null);

  useEffect(() => {
    api<NavItem[]>('/navigation').then((items) => items.length && setLinks(items)).catch(() => undefined);
    api<UserInfo>('/auth/me').then(setMe).catch(() => setMe(null));
    const saved = (localStorage.getItem('raed-theme') as 'light' | 'dark' | null) || 'light';
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  const accountHref = useMemo(() => {
    if (!me) return '/login';
    return me.role === 'admin' || me.role === 'owner' ? '/admin' : '/student';
  }, [me]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('raed-theme', next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="Mr. Raed Zeid home">
          <img src="/media/logo.png" alt="Mr. Raed Zeid" />
        </Link>

        <div className="nav-links nav-links-desktop">
          {links.slice(0, 5).map((item) => <Link key={item.slug} href={item.path}>{item.title}</Link>)}
        </div>

        <div className="nav-actions header-actions">
          <Link className="header-search-btn" href="/student/search" aria-label="بحث" title="بحث">⌕</Link>
          <button className="header-control" type="button" onClick={toggleTheme} aria-label="تبديل المظهر" title="المظهر">
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
          </button>
          <Link className="header-control lang-control" href="/en" aria-label="English version">EN</Link>
          {!me ? (
            <>
              <Link className="btn btn-soft account-action hide-compact" href="/register">حساب جديد</Link>
              <Link className="btn btn-dark account-action" href="/login">تسجيل الدخول</Link>
            </>
          ) : (
            <Link className="btn btn-dark account-action" href={accountHref}>{me.role === 'admin' || me.role === 'owner' ? 'لوحة الإدارة' : 'حسابي'}</Link>
          )}
          <button className="menu-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="فتح القائمة">
            <span /><span /><span />
          </button>
        </div>

        <div className={`mobile-menu ${open ? 'open' : ''}`}>
          <div className="mobile-menu-head">
            <b>القائمة</b>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
          </div>
          <div className="mobile-menu-links">
            {links.map((item) => <Link key={item.slug} href={item.path} onClick={() => setOpen(false)}>{item.title}</Link>)}
            <Link href="/student/search" onClick={() => setOpen(false)}>البحث</Link>
          </div>
          <div className="mobile-menu-actions">
            {!me && <Link className="btn" href="/register" onClick={() => setOpen(false)}>حساب جديد</Link>}
            <Link className="btn btn-dark" href={accountHref} onClick={() => setOpen(false)}>{me ? 'حسابي' : 'تسجيل الدخول'}</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
