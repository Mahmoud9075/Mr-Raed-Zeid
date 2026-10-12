import Link from 'next/link';

type Lang = 'ar' | 'en';

export default function Hero({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <section className="hero" dir={en ? 'ltr' : 'rtl'}>
      <div className="container">
        <div className="hero-card">
          <div className="hero-copy">
            <h1 className="hero-name">Mr. Raed <span>Zeid.</span></h1>
            <h2 className="hero-tagline">{en ? 'Understand English. Speak with confidence.' : 'افهم الإنجليزي. اتكلم بثقة.'}</h2>
            <p className="hero-desc">
              {en
                ? 'English teacher with more than 8 years of experience. Clear explanations, practical training, and continuous follow-up for students.'
                : 'مستر رائد زيد، مدرس لغة إنجليزية بخبرة أكثر من 8 سنوات. شرح واضح، تدريب عملي، ومتابعة مستمرة للطلاب.'}
            </p>
            <div className="hero-badges">
              <span className="pill">{en ? '8+ years experience' : '8+ سنوات خبرة'}</span>
              <span className="pill">{en ? 'Preparatory & secondary' : 'إعدادي وثانوي'}</span>
              <span className="pill">{en ? 'Continuous follow-up' : 'متابعة مستمرة'}</span>
            </div>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={en ? '/en#moments' : '/#moments'}>{en ? 'See center life' : 'شوف أجواء السنتر'}</Link>
              <Link className="btn" href={en ? '/en#about' : '/#about'}>{en ? 'About Mr. Raed' : 'اعرف المستر'}</Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="portrait-frame"><img src="/media/hero-raed.jpg" alt="Mr. Raed Zeid" /></div>
            <div className="portrait-label">{en ? 'English Teacher · Abu Hummus' : 'مدرس اللغة الإنجليزية · أبو حمص'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
