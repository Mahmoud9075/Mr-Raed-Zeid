'use client';
import Header from '@/components/Header';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api,QuizSummary} from '@/lib/api';

export default function Quizzes(){
 const [quizzes,setQuizzes]=useState<QuizSummary[]>([]); const [loading,setLoading]=useState(true); const [login,setLogin]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{api<QuizSummary[]>('/quizzes').then(setQuizzes).catch(e=>{const m=e instanceof Error?e.message:'';if(m.includes('تسجيل الدخول')||m.includes('جلسة'))setLogin(true);else setError(m)}).finally(()=>setLoading(false))},[]);
 return <><Header/><main className="section"><div className="container"><span className="eyebrow">الكويزات والامتحانات</span><h1 className="section-title">اختباراتك في مكان واحد</h1><p className="section-subtitle">الاختبارات بتظهر حسب مرحلتك وصفك بعد تسجيل الدخول، والنتيجة تتسجل داخل حسابك.</p>
  {loading?<div className="card" style={{padding:28,marginTop:30}}>جاري تحميل الاختبارات...</div>:login?<div className="card login-required"><h2>سجّل دخولك عشان تشوف اختبارات صفك</h2><p>كل طالب بيشوف الاختبارات المخصصة لمرحلته ونوع التعليم والصف.</p><Link className="btn btn-dark" href="/login">تسجيل الدخول</Link></div>:error?<div className="notice error">{error}</div>:<div className="quiz-list">{quizzes.length===0?<div className="card" style={{padding:28}}><h3>لا توجد اختبارات منشورة لصفك حاليًا</h3><p>لما المستر ينشر اختبار جديد هيظهر هنا تلقائيًا.</p></div>:quizzes.map(q=><article className="card quiz-list-card" key={q.id}><div><span className="eyebrow">{[q.stage,q.education_type,q.grade].filter(Boolean).join(' · ')||'اختبار عام'}</span><h2>{q.title_ar}</h2><p>{q.description_ar}</p><div className="quiz-meta"><span>{q.question_count} سؤال</span><span>{q.duration_minutes} دقيقة</span><span>حتى {q.max_attempts} محاولة</span></div></div><Link className="btn btn-dark" href={`/quizzes/${q.slug}`}>دخول الاختبار ←</Link></article>)}</div>}
 </div></main></>
}
