'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Item={id:number;student_name:string;phone:string;stage?:string;education_type?:string;grade?:string;quiz:string;score:number|null;level_result?:string;needs_manual_review:boolean;submitted_at?:string};
type Page={items:Item[];total:number};

export default function PrintResults(){
  const [data,setData]=useState<Page|null>(null); const [error,setError]=useState('');
  useEffect(()=>{api<Page>('/admin/results?page_size=1000').then(setData).catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل النتائج'))},[]);
  return <main className="print-report" dir="rtl"><div className="print-toolbar"><button onClick={()=>window.print()}>طباعة / حفظ PDF</button><button onClick={()=>window.close()}>إغلاق</button></div><header><h1>تقرير نتائج طلاب مستر رائد زيد</h1><p>إجمالي النتائج: {data?.total??0}</p></header>{error&&<p>{error}</p>}<table><thead><tr><th>الطالب</th><th>الهاتف</th><th>المرحلة / الصف</th><th>الاختبار</th><th>الدرجة</th><th>المستوى</th><th>الحالة</th></tr></thead><tbody>{data?.items.map(x=><tr key={x.id}><td>{x.student_name}</td><td>{x.phone}</td><td>{[x.stage,x.education_type,x.grade].filter(Boolean).join(' / ')}</td><td>{x.quiz}</td><td>{x.score??0}%</td><td>{x.level_result||'—'}</td><td>{x.needs_manual_review?'بانتظار التصحيح':'مكتمل'}</td></tr>)}</tbody></table></main>
}
