'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, assetUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Me={id:number;first_name:string;last_name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;profile_image?:string;role:string;is_verified?:boolean;created_at?:string};
type Attempt={id:number;quiz:string;started_at:string;submitted_at?:string;score?:number;level_result?:string;status?:string};
type Note={id:number;title:string;body:string;created_at:string};

export default function Student(){
  const [me,setMe]=useState<Me|null>(null); const [attempts,setAttempts]=useState<Attempt[]>([]); const [notes,setNotes]=useState<Note[]>([]); const [err,setErr]=useState(''); const router=useRouter();
  useEffect(()=>{Promise.all([api<Me>('/auth/me'),api<Attempt[]>('/quizzes/attempts/mine'),api<Note[]>('/notifications')]).then(([u,a,n])=>{if(u.role==='admin'||u.role==='owner'){router.push('/admin');return}setMe(u);setAttempts(a);setNotes(n)}).catch(e=>setErr(e instanceof Error?e.message:'تعذر تحميل الحساب'))},[router]);
  const submitted=attempts.filter(x=>x.submitted_at && typeof x.score==='number');
  const scores=submitted.map(x=>Number(x.score));
  const avg=useMemo(()=>scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,[attempts]);
  const lastScore=submitted[0]?.score;
  const weekActivity=useMemo(()=>{const days=Array(7).fill(false);const now=new Date();attempts.forEach(a=>{const d=new Date(a.started_at);const diff=Math.floor((+new Date(now.getFullYear(),now.getMonth(),now.getDate())-+new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000);if(diff>=0&&diff<7)days[6-diff]=true});return days},[attempts]);
  async function logout(){await api('/auth/logout',{method:'POST',body:JSON.stringify({})}).catch(()=>{});router.push('/')}
  async function share(){const url=location.href;const text=`حساب ${me?.first_name||''} على منصة مستر رائد`;try{if(navigator.share)await navigator.share({title:'منصة مستر رائد',text,url});else{await navigator.clipboard.writeText(url);alert('تم نسخ رابط الصفحة')}}catch{}}
  if(err)return <><Header/><main className="auth-wrap"><div className="notice error">{err} — <Link href="/login">سجّل الدخول</Link></div></main></>;
  if(!me)return <><Header/><main className="auth-wrap"><div className="card loading-card">جاري تحميل حسابك...</div></main></>;
  const memberSince=me.created_at?new Date(me.created_at).toLocaleDateString('ar-EG',{month:'long',year:'numeric'}):'—';
  const badge=avg!=null&&avg>=80?'طالب متميز':'طالب مجتهد';
  return <><Header/><main className="section student-home"><div className="container student-command">
    <aside className="card student-profile-card">
      <div className="profile-card-top"><span className="student-badge">👑 {badge}</span><span>عضو منذ {memberSince}</span></div>
      <div className="student-main-avatar">{me.profile_image?<img src={assetUrl(me.profile_image)} alt="الصورة الشخصية"/>:<span>{me.first_name.charAt(0)}</span>}<Link href="/student/profile" className="avatar-camera" aria-label="تغيير الصورة">📷</Link></div>
      <h1>{me.first_name} {me.last_name}</h1>
      <div className="week-activity"><b>نشاطك الأسبوع ده</b><div>{weekActivity.map((active,i)=><span key={i} className={active?'active':''}/>)}</div></div>
      <div className="profile-mini-stats"><div><b>{avg==null?'—':`${avg}%`}</b><span>متوسط الدرجات</span></div><div><b>{submitted.length}</b><span>كويز خلصته</span></div></div>
      <div className={`verify-strip ${me.is_verified?'verified':''}`}><b>{me.is_verified?'✓ حساب متحقق':'▣ غير متحقق'}</b><span>{me.is_verified?'بيانات الحساب متحققة':'حدّث بياناتك وتأكد من البريد المسجل'}</span></div>
      <div className="profile-info-list"><div><span>📞</span><b dir="ltr">{me.phone}</b></div><div><span>🏫</span><b>{[me.stage,me.education_type,me.grade].filter(Boolean).join(' · ')||'لم يتم تحديد الصف'}</b></div>{me.guardian_phone&&<div><span>👥</span><b>ولي الأمر: <span dir="ltr">{me.guardian_phone}</span></b></div>}<div><span>✉️</span><b dir="ltr">{me.email}</b></div></div>
      <div className="profile-card-actions"><Link href="/student/profile">✎<span>تعديل</span></Link><Link href="/student/profile">📷<span>الصورة</span></Link><button onClick={share}>⌯<span>مشاركة</span></button></div>
      <button className="profile-logout" onClick={logout}>تسجيل خروج</button>
    </aside>

    <section className="student-workspace"><div className="student-welcome"><div><span className="eyebrow">بوابة الطالب</span><h2>أهلًا {me.first_name}</h2><p>{[me.stage,me.education_type,me.grade].filter(Boolean).join(' · ')}</p></div><Link className="btn btn-dark" href="/student/path">المسار الشهري</Link></div>
      <div className="stat-grid"><div className="card stat"><span>الاختبارات</span><b>{attempts.length}</b></div><div className="card stat"><span>متوسط النتائج</span><b>{avg===null?'—':avg+'%'}</b></div><div className="card stat"><span>آخر نتيجة</span><b>{lastScore==null?'—':lastScore+'%'}</b></div><div className="card stat"><span>الإشعارات</span><b>{notes.length}</b></div></div>
      <div className="student-quick-grid"><Link className="card quick-card" href="/student/path"><b>المسار والاختبارات</b><span>شوف المتاح والمقفول وتقدمك شهر بشهر</span></Link><Link className="card quick-card" href="/student/assistant"><b>اسأل المساعد</b><span>كلمات، قواعد، مواعيد ونتائجك</span></Link><Link className="card quick-card" href="/student/search"><b>بحث الموقع</b><span>دور على اختبار أو معلومة بسرعة</span></Link><Link className="card quick-card" href="/student/profile"><b>تعديل حسابك</b><span>الصورة والبيانات والمرحلة</span></Link></div>
      <div className="two-col-dashboard"><div className="card student-progress-card"><h2>تقدمك</h2>{submitted.length===0?<p>ابدأ أول اختبار عشان يظهر تقدمك هنا.</p>:<div className="progress-list">{submitted.slice(0,6).map(a=><div key={a.id}><div><b>{a.quiz}</b><span>{a.score??'—'}%</span></div><div className="progress"><i style={{width:`${a.score||0}%`}}/></div></div>)}</div>}</div><div className="card student-progress-card"><h2>آخر الإشعارات</h2>{notes.length===0?<p>مفيش إشعارات جديدة.</p>:notes.slice(0,5).map(n=><div className="notification-item" key={n.id}><b>{n.title}</b><p>{n.body}</p></div>)}</div></div>
    </section>
  </div></main></>;
}
