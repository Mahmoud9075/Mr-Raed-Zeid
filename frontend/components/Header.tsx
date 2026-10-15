'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Lang = 'ar' | 'en';
type NavItem = { slug: string; title: string; path: string; is_system?: boolean };
type Me = { role: string; first_name: string };

const FALLBACK_NAV: NavItem[] = [
  { slug: 'home', title: 'الرئيسية', path: '/' },
  { slug: 'about', title: 'عن المستر', path: '/#about' },
  { slug: 'quizzes', title: 'الكويزات والامتحانات', path: '/quizzes' },
  { slug: 'moments', title: 'الأجواء', path: '/#moments' },
  { slug: 'students', title: 'طلابنا', path: '/#students' },
  { slug: 'honors', title: 'تكريمات نعتز بها', path: '/#honors' },
  { slug: 'reviews', title: 'آراء الطلاب', path: '/#reviews' },
  { slug: 'contact', title: 'تواصل', path: '/#contact' },
];

const EN_TITLES: Record<string, string> = {
  home: 'Home', about: 'About', quizzes: 'Quizzes & Exams', moments: 'Center Life',
  students: 'Students', honors: 'Honors', reviews: 'Reviews', contact: 'Contact'
};

function englishPath(item: NavItem) {
  if (item.slug === 'home') return '/en';
  if (item.path.startsWith('/#')) return `/en${item.path.slice(1)}`;
  return item.path;
}

export default function Header({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [nav, setNav] = useState<NavItem[]>(FALLBACK_NAV);
  const [me, setMe] = useState<Me | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    api<NavItem[]>('/navigation').then((items) => items.length && setNav(items)).catch(() => {});
    api<Me>('/auth/me').then(setMe).catch(() => setMe(null));
    const saved = window.localStorage.getItem('theme');
    const next = saved === 'dark' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', menuOpen);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('nav-menu-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('theme', next);
  }

  const items = useMemo(() => nav.filter((item) => !['home', 'quizzes'].includes(item.slug)), [nav]);
  const isAdminSession = !!me && ['admin', 'owner'].includes(me.role);
  const publicUser = me && !isAdminSession ? me : null;
  const accountHref = publicUser ? '/student' : '/login';
  const accountLabel = publicUser ? (en ? 'My account' : 'حسابي') : (en ? 'Sign in' : 'تسجيل الدخول');

  return (
    <>
      <header className="site-header minimal-header" dir={en ? 'ltr' : 'rtl'}>
        <nav className="nav-shell minimal-nav" aria-label={en ? 'Main navigation' : 'التنقل الرئيسي'}>
          <Link className="brand" href={en ? '/en' : '/'} aria-label="Mr. Raed Zeid">
            <img src="/media/logo.webp" alt="Mr. Raed Zeid" />
          </Link>

          <div className="minimal-nav-actions">
            <Link
              className="nav-quick-action nav-account-link"
              href={isAdminSession ? '/admin' : accountHref}
              aria-label={isAdminSession ? (en ? 'Admin dashboard' : 'لوحة الإدارة') : accountLabel}
            >
              <span className="nav-action-icon" aria-hidden="true">◉</span>
              <span className="nav-action-label nav-account-full">{isAdminSession ? (en ? 'Admin' : 'لوحة الإدارة') : accountLabel}</span>
              <span className="nav-action-label nav-account-short">{isAdminSession ? (en ? 'Admin' : 'الإدارة') : (publicUser ? (en ? 'Account' : 'حسابي') : (en ? 'Login' : 'دخول'))}</span>
            </Link>

            <Link
              className="nav-quick-action nav-language-link"
              href={en ? '/' : '/en'}
              aria-label={en ? 'العربية' : 'English'}
            >
              <span aria-hidden="true">◎</span>
              <b>{en ? 'AR' : 'EN'}</b>
            </Link>

            <button
              className="nav-quick-action nav-theme-button"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? (en ? 'Use light mode' : 'تفعيل الوضع الفاتح') : (en ? 'Use dark mode' : 'تفعيل الوضع الداكن')}
              title={theme === 'dark' ? (en ? 'Light mode' : 'الوضع الفاتح') : (en ? 'Dark mode' : 'الوضع الداكن')}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>

            <button
              className={`menu-trigger ${menuOpen ? 'is-open' : ''}`}
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-controls="main-site-menu"
              aria-label={menuOpen ? (en ? 'Close menu' : 'إغلاق القائمة') : (en ? 'Open menu' : 'فتح القائمة')}
            >
              <span/><span/><span/>
            </button>
          </div>
        </nav>

        <button
          className={`menu-backdrop ${menuOpen ? 'open' : ''}`}
          type="button"
          aria-label={en ? 'Close menu' : 'إغلاق القائمة'}
          onClick={() => setMenuOpen(false)}
        />

        <aside id="main-site-menu" className={`mobile-menu site-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
          <div className="mobile-menu-head">
            <div>
              <span className="drawer-kicker">MR. RAED ZEID</span>
              <b>{en ? 'Quick navigation' : 'اختصارات الموقع'}</b>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={en ? 'Close menu' : 'إغلاق القائمة'}>×</button>
          </div>

          <div className="drawer-shortcuts">
            <Link className="drawer-shortcut" href={en ? '/en' : '/'} onClick={() => setMenuOpen(false)}>
              <span>⌂</span><b>{en ? 'Home' : 'الرئيسية'}</b>
            </Link>
            <Link className="drawer-shortcut" href="/quizzes/english-placement-50" onClick={() => setMenuOpen(false)}>
              <span>✓</span><b>{en ? 'Placement test' : 'تحديد المستوى'}</b>
            </Link>
            {!isAdminSession && <Link className="drawer-shortcut" href={accountHref} onClick={() => setMenuOpen(false)}>
              <span>◉</span><b>{accountLabel}</b>
            </Link>}
          </div>

          <div className="drawer-section-title">{en ? 'Explore' : 'تصفح الموقع'}</div>
          <div className="mobile-menu-links">
            {items.map((item) => (
              <Link key={item.slug} href={en ? englishPath(item) : item.path} onClick={() => setMenuOpen(false)}>
                {en ? (EN_TITLES[item.slug] || item.title) : item.title}
              </Link>
            ))}
          </div>

          <div className="drawer-tools">
            <Link href={publicUser ? '/student/search' : '/login'} onClick={() => setMenuOpen(false)}>{publicUser ? (en ? 'Search' : 'بحث') : (en ? 'Sign in to search' : 'سجّل دخول للبحث')}</Link>
            <button type="button" onClick={toggleTheme}>{theme === 'dark' ? (en ? 'Light mode' : 'الوضع الفاتح') : (en ? 'Dark mode' : 'الوضع الداكن')}</button>
            <Link href={en ? '/' : '/en'} onClick={() => setMenuOpen(false)}>{en ? 'العربية' : 'English'}</Link>
          </div>

          {!me && <Link className="btn btn-primary drawer-register" href="/register" onClick={() => setMenuOpen(false)}>{en ? 'Create account' : 'إنشاء حساب جديد'}</Link>}
        </aside>
      </header>
      <div className="site-header-spacer" aria-hidden="true" />
    </>
  );
}
