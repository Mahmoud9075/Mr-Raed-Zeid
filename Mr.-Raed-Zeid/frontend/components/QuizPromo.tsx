import Link from 'next/link';
export default function QuizPromo(){
 return <section className="section soft-section"><div className="container"><span className="eyebrow">الكويزات والامتحانات</span><h2 className="section-title">اختبر مستواك وابدأ من المكان الصح</h2><p className="section-subtitle">اختبار تحديد مستوى متدرج في القواعد والمفردات والاستخدام، مع نتيجة فورية داخل حساب الطالب.</p>
 <div className="quiz-teaser"><div className="card quiz-ready"><h3>اختبار تحديد المستوى</h3><p>50 سؤالًا متدرجًا من A1 إلى C1+، في واجهة سؤال واحد كل مرة.</p><div className="quiz-meta"><span>50 سؤال</span><span>30 دقيقة</span><span>نتيجة فورية</span></div><Link className="btn btn-dark" href="/quizzes">دخول الاختبار ←</Link></div><div className="quiz-visual"><div><div className="quiz-number">50</div><p>سؤالًا لتحديد مستواك</p></div></div></div>
 </div></section>
}
