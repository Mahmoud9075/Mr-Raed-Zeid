import Link from 'next/link';

type Lang = 'ar' | 'en';

export default function QuizPromo({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <section id="quizzes" className="section soft-section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container">
        <span className="eyebrow">{en ? 'Quizzes & exams' : 'الكويزات والامتحانات'}</span>
        <h2 className="section-title">{en ? 'Your exams appear when Mr. Raed publishes them' : 'اختباراتك بتظهر أول ما المستر ينشرها'}</h2>
        <p className="section-subtitle">
          {en
            ? 'After signing in, each student sees only the quizzes assigned to their stage, education type, and grade.'
            : 'بعد تسجيل الدخول، كل طالب بيشوف الاختبارات المخصصة لمرحلته ونوع التعليم والصف فقط.'}
        </p>
        <div className="quiz-teaser quiz-teaser-clean">
          <div className="card quiz-ready">
            <h3>{en ? 'Student quizzes' : 'اختبارات الطالب'}</h3>
            <p>{en ? 'No fake exams or results are shown. If there is no published exam, the platform clearly tells the student.' : 'مفيش امتحانات أو نتائج وهمية. لو مفيش امتحان منشور، المنصة بتوضح للطالب إن مفيش اختبار متاح حاليًا.'}</p>
            <div className="quiz-meta">
              <span>{en ? 'By stage' : 'حسب المرحلة'}</span>
              <span>{en ? 'By grade' : 'حسب الصف'}</span>
              <span>{en ? 'Saved results' : 'نتائج محفوظة'}</span>
            </div>
            <Link className="btn btn-dark" href="/quizzes">{en ? 'Open quizzes' : 'دخول الاختبارات'}</Link>
          </div>
          <div className="quiz-visual quiz-visual-message">
            <div>
              <span className="quiz-status-dot" />
              <h3>{en ? 'No exam yet?' : 'لسه مفيش امتحان؟'}</h3>
              <p>{en ? 'A new exam will appear here automatically as soon as it is published.' : 'هيظهر هنا تلقائيًا أول ما مستر رائد ينشره.'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
