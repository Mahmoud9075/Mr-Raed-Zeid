import Link from 'next/link';

type Lang = 'ar' | 'en';

export default function QuizPromo({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <section id="quizzes" className="section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container">
        <span className="eyebrow">{en ? 'Quizzes & exams' : 'الكويزات والامتحانات'}</span>
        <h2 className="section-title">{en ? 'Practice, test yourself, and see your result' : 'اختبر نفسك واعرف نتيجتك فورًا'}</h2>
        <p className="section-subtitle">{en ? 'Student quizzes are organized by stage and grade. Sign in to see the tests available for your account.' : 'كل طالب بيشوف الاختبارات المناسبة لمرحلته وصفه بعد تسجيل الدخول، والنتيجة بتتحفظ داخل حسابه.'}</p>
        <div className="quiz-teaser quiz-teaser-clean">
          <div className="card quiz-ready">
            <h3>{en ? 'English placement test' : 'اختبار تحديد المستوى'}</h3>
            <p>{en ? '50 questions, one question at a time, with clear progress and an immediate estimated level at the end.' : '50 سؤال، سؤال واحد في كل خطوة، مع مؤشر تقدم واضح ونتيجة ومستوى مبدئي فور الانتهاء.'}</p>
            <div className="quiz-meta"><span>{en ? '50 questions' : '50 سؤال'}</span><span>{en ? 'One by one' : 'سؤال واحد كل مرة'}</span><span>{en ? 'Instant result' : 'نتيجة فورية'}</span></div>
            <Link className="btn btn-dark" href="/quizzes/english-placement-50">{en ? 'Start placement test →' : 'ابدأ اختبار تحديد المستوى ←'}</Link>
          </div>
          <div className="quiz-visual quiz-visual-message">
            <span className="quiz-status-dot" aria-hidden="true" />
            <div className="quiz-number">50</div>
            <h3>{en ? 'Questions' : 'سؤال'}</h3>
            <p>{en ? 'Your progress is saved to your student account.' : 'تقدمك ونتيجتك بيتسجلوا داخل حساب الطالب.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
