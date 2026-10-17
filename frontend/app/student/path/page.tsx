'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type PathQuiz = {
  quiz_id:number; slug:string; title:string; description:string; week_label?:string; status:string; locked:boolean;
  lock_reason?:string; best_score?:number|null; passing_score:number; duration_minutes:number; attempts_used:number; max_attempts:number;
};
type Month = {id:number;title:string;stage?:string;education_type?:string;grade?:string;quizzes:PathQuiz[]};

const labels:Record<string,string>={passed:'ناجح',in_progress:'مستمر',attempted:'حاول تاني',available:'متاح',locked:'مقفول',scheduled:'قريبًا',expired:'انتهى'};

export default function StudentPathPage(){
  const [months,setMonths]=useState<Month[]>([]); const [error,setError]=useState('');
  useEffect(()=>{api<Month[]>('/path').then(setMonths).catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل المسار'))},[]);
  return <><Header/><main className="section"><div className="container student-path-page">
    <div className="student-path-head"><div><span className="eyebrow">المسار الدراسي</span><h1 className="section-title">اختباراتك شهر بشهر</h1><p className="section-subtitle">كل اختبار يفتح حسب ترتيب المسار والنسبة المطلوبة من الاختبار السابق.</p></div><Link className="btn" href="/student">لوحة الطالب</Link></div>
    {error&&<div className="notice error">{error}</div>}
    {!error&&months.length===0&&<div className="card empty-path"><h2>المسار لسه بيتجهز</h2><p>لما مستر رائد يضيف اختبارات لصفك هتظهر هنا بالترتيب.</p></div>}
    <div className="month-stack">{months.map(month=><section className="card month-card" key={month.id}><div className="month-title"><div><span>المسار الشهري</span><h2>{month.title}</h2></div><small>{[month.stage,month.education_type,month.grade].filter(Boolean).join(' · ')}</small></div><div className="path-quiz-list">{month.quizzes.map((quiz,index)=><article className={`path-quiz ${quiz.status}`} key={quiz.quiz_id}><div className="path-step"><b>{index+1}</b></div><div className="path-quiz-copy"><div className="path-quiz-top"><div><small>{quiz.week_label||`الاختبار ${index+1}`}</small><h3>{quiz.title}</h3></div><span className={`path-status ${quiz.status}`}>{labels[quiz.status]||quiz.status}</span></div>{quiz.description&&<p>{quiz.description}</p>}<div className="path-meta"><span>{quiz.duration_minutes} دقيقة</span><span>النجاح {quiz.passing_score}%</span><span>{quiz.attempts_used}/{quiz.max_attempts} محاولات</span>{quiz.best_score!=null&&<span>أفضل نتيجة {quiz.best_score}%</span>}</div>{quiz.locked&&quiz.lock_reason&&<div className="path-lock-reason">🔒 {quiz.lock_reason}</div>}</div><div className="path-action">{quiz.locked?<button className="btn" disabled>مقفول</button>:<Link className="btn btn-dark" href={`/quizzes/${quiz.slug}`}>{quiz.status==='in_progress'?'كمّل':'ابدأ'}</Link>}</div></article>)}</div></section>)}</div>
  </div></main></>;
}
