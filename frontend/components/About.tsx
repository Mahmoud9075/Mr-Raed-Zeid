'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Lang = 'ar' | 'en';

export default function About({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  const [settings, setSettings] = useState<Record<string,string>>({});
  useEffect(() => { api<Record<string,string>>('/site-settings').then(setSettings).catch(() => {}); }, []);

  const stages = useMemo(() => {
    const items: { ar: string; en: string; enabled: boolean }[] = [
      { ar: 'إعدادي', en: 'Preparatory', enabled: settings.stage_prep_enabled !== 'false' },
      { ar: 'ثانوي عام', en: 'General secondary', enabled: settings.stage_secondary_enabled !== 'false' },
      { ar: 'ثانوي أزهري', en: 'Azhar secondary', enabled: settings.stage_secondary_enabled !== 'false' },
      { ar: 'ثانوي فني', en: 'Technical secondary', enabled: settings.stage_secondary_enabled !== 'false' },
      { ar: 'تجاري وزراعي', en: 'Commercial & agricultural', enabled: settings.stage_secondary_enabled !== 'false' },
      { ar: 'كورسات للكبار', en: 'Adult courses', enabled: settings.stage_adults_enabled !== 'false' },
    ];
    return items.filter((item) => item.enabled).map((item) => en ? item.en : item.ar);
  }, [en, settings]);

  return (
    <section id="about" className="section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container about-grid">
        <div className="about-copy">
          <span className="eyebrow">{en ? 'About the teacher' : 'نبذة عن المستر'}</span>
          <h2 className="section-title">{en ? 'Mr. Raed Zeid' : 'مستر رائد زيد'}</h2>
          <p className="about-intro">{en ? 'English teacher, Faculty of Arts graduate from Damanhour University, English Department – Languages and Translation. Master’s researcher in English with an educational diploma and more than 8 years of teaching and translation experience.' : 'مدرس لغة إنجليزية، خريج كلية الآداب – جامعة دمنهور، قسم اللغة الإنجليزية – شعبة لغات وترجمة. باحث ماجستير في اللغة الإنجليزية، وحاصل على دبلومة تربوية، ويعمل في التدريس والترجمة منذ أكثر من 8 سنوات.'}</p>
          <div className="stage-list">{stages.map((stage) => <span key={stage}>{stage}</span>)}</div>
          <details className="about-details">
            <summary>{en ? 'View full details' : 'عرض النبذة كاملة'}</summary>
            <div className="fact-list">
              <div className="fact"><b>{en ? 'Education' : 'الدراسة'}</b><span>{en ? 'Faculty of Arts – Damanhour University · English Department – Languages and Translation' : 'كلية الآداب – جامعة دمنهور · قسم اللغة الإنجليزية – شعبة لغات وترجمة'}</span></div>
              <div className="fact"><b>{en ? 'Qualifications' : 'التأهيل'}</b><span>{en ? 'Master’s researcher in English · Educational diploma · ICDL TEACHER' : 'باحث ماجستير في اللغة الإنجليزية · دبلومة تربوية · ICDL TEACHER'}</span></div>
              <div className="fact"><b>{en ? 'Teaching system' : 'النظام'}</b><span>{en ? 'Interactive board · practical exercises · homework and correction · tests after each unit · exam reviews' : 'شرح تفاعلي · واجبات وتصحيح · اختبارات بعد كل وحدة · مراجعات حتى ليلة الامتحان'}</span></div>
            </div>
          </details>
        </div>
        <figure className="about-photo"><img src="/media/about-raed.webp" alt={en ? 'Mr. Raed at his desk' : 'مستر رائد زيد في مكتبه'} /></figure>
      </div>
    </section>
  );
}
