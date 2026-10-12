type Lang = 'ar' | 'en';

export default function Achievements({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <>
      <section id="students" className="section" dir={en ? 'ltr' : 'rtl'}>
        <div className="container achievement-grid">
          <div>
            <span className="eyebrow">{en ? 'Students we are proud of' : 'طلاب نفتخر بهم'}</span>
            <h2 className="section-title">{en ? 'Outstanding students' : 'أوائل نفتخر بيهم'}</h2>
            <p className="section-subtitle">{en ? 'Real examples of student achievement and progress.' : 'نماذج حقيقية من تفوق طلابنا، مع تمنياتنا بالمزيد من النجاح والتقدم.'}</p>
            <div className="rank-list">
              <div className="rank"><strong>01</strong><div><b>{en ? 'Youssef Ibrahim Youssef Shaaban' : 'يوسف إبراهيم يوسف شعبان'}</b><div>{en ? 'First place' : 'المركز الأول'}</div></div></div>
              <div className="rank"><strong>02</strong><div><b>{en ? 'Mohamed Mahmoud El-Khabbaz' : 'محمد محمود الخباز'}</b><div>{en ? 'Second place' : 'المركز الثاني'}</div></div></div>
            </div>
          </div>
          <img loading="lazy" src="/media/top-students.jpg" alt={en ? 'Outstanding students' : 'طلاب نفتخر بهم'} />
        </div>
      </section>
      <section id="honors" className="section soft-section" dir={en ? 'ltr' : 'rtl'}>
        <div className="container">
          <span className="eyebrow">{en ? 'Honors we value' : 'تكريمات نعتز بها'}</span>
          <h2 className="section-title">{en ? 'Recognition and memorable moments' : 'ذكريات وشهادات تقدير'}</h2>
          <p className="section-subtitle">{en ? 'Photos from recognition moments and certificates at the center.' : 'صور من ركن التكريمات وشهادات التقدير داخل السنتر.'}</p>
          <div className="honor-grid">{[1, 2, 3, 4, 5].map((i) => <img loading="lazy" key={i} src={`/media/honor-${String(i).padStart(2, '0')}.jpg`} alt={en ? 'Mr. Raed honors' : 'تكريمات مستر رائد'} />)}</div>
        </div>
      </section>
    </>
  );
}
