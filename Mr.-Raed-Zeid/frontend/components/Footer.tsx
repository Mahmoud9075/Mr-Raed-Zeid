type Lang = 'ar' | 'en';
export default function Footer({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return <footer className="footer" dir={en ? 'ltr' : 'rtl'}><div className="container footer-inner"><b>Mr. Raed Zeid</b><span>{en ? 'English Teacher · Abu Hummus' : 'مدرس اللغة الإنجليزية · أبو حمص'}</span><span>{en ? '© 2026 All rights reserved' : '© 2026 جميع الحقوق محفوظة'}</span></div></footer>;
}
