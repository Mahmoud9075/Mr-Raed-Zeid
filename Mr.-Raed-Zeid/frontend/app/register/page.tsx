'use client';
import Header from '@/components/Header';
import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useState} from 'react';
import {api} from '@/lib/api';
import {useRouter} from 'next/navigation';

const defaultStages=['إعدادي','ثانوي','جامعي','كورسات للكبار'];
const types:Record<string,string[]>={
 'ابتدائي':['عام','أزهري'],
 'إعدادي':['عام','أزهري'],
 'ثانوي':['عام','أزهري','فني صناعي','تجاري','زراعي'],
 'جامعي':['جامعي'],
 'كورسات للكبار':['كورسات عامة']
};
const grades:Record<string,string[]>={
 'ابتدائي':['الصف الأول الابتدائي','الصف الثاني الابتدائي','الصف الثالث الابتدائي','الصف الرابع الابتدائي','الصف الخامس الابتدائي','الصف السادس الابتدائي'],
 'إعدادي':['الصف الأول الإعدادي','الصف الثاني الإعدادي','الصف الثالث الإعدادي'],
 'ثانوي':['الصف الأول الثانوي','الصف الثاني الثانوي','الصف الثالث الثانوي'],
 'جامعي':['الفرقة الأولى','الفرقة الثانية','الفرقة الثالثة','الفرقة الرابعة','الفرقة الخامسة'],
 'كورسات للكبار':['كورسات للكبار']
};

export default function Register(){
 const [msg,setMsg]=useState(''); const [stage,setStage]=useState(''); const [educationType,setEducationType]=useState(''); const [step,setStep]=useState(1); const [stageOptions,setStageOptions]=useState(defaultStages); const router=useRouter();
 useEffect(()=>{api<Record<string,string>>('/site-settings').then(s=>{const x:string[]=[];if(s.stage_primary_enabled==='true')x.push('ابتدائي');if(s.stage_prep_enabled!=='false')x.push('إعدادي');if(s.stage_secondary_enabled!=='false')x.push('ثانوي');if(s.stage_university_enabled!=='false')x.push('جامعي');if(s.stage_adults_enabled!=='false')x.push('كورسات للكبار');if(x.length)setStageOptions(x)}).catch(()=>{})},[]);
 const gradeOptions=useMemo(()=>grades[stage]||[],[stage]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault(); const f=new FormData(e.currentTarget); if(f.get('password')!==f.get('confirm')){setMsg('كلمتا المرور غير متطابقتين');return} try{await api('/auth/register',{method:'POST',body:JSON.stringify({first_name:f.get('first_name'),last_name:f.get('last_name'),email:f.get('email'),phone:f.get('phone'),guardian_phone:f.get('guardian_phone'),stage:f.get('stage'),education_type:f.get('education_type'),grade:f.get('grade'),school_name:f.get('school_name'),password:f.get('password')})}); router.push('/login')}catch(err){setMsg(err instanceof Error?err.message:'تعذر إنشاء الحساب')}}
 return <><Header/><main className="auth-wrap"><form className="card auth-card wizard-card" onSubmit={submit}>
  <div className="auth-tabs"><Link href="/login">دخول</Link><Link className="active" href="/register">حساب جديد</Link></div>
  <div className="wizard-progress"><span className={step>=1?'on':''}>1</span><i/><span className={step>=2?'on':''}>2</span><i/><span className={step>=3?'on':''}>3</span></div>
  {step===1&&<div><span className="eyebrow">الخطوة 1 من 3</span><h1>بيانات الطالب</h1><div className="form-grid"><div className="field"><label>الاسم الأول</label><input className="input" name="first_name" required/></div><div className="field"><label>الاسم الأخير</label><input className="input" name="last_name" required/></div><div className="field"><label>رقم موبايل الطالب</label><input className="input" name="phone" required/></div><div className="field"><label>رقم ولي الأمر</label><input className="input" name="guardian_phone"/></div></div><button type="button" className="btn btn-dark" style={{width:'100%',marginTop:18}} onClick={()=>setStep(2)}>التالي</button></div>}
  {step===2&&<div><span className="eyebrow">الخطوة 2 من 3</span><h1>المرحلة الدراسية</h1><div className="form-grid"><div className="field"><label>المرحلة</label><select className="input" name="stage" required value={stage} onChange={e=>{setStage(e.target.value);setEducationType('')}}><option value="">اختر المرحلة</option>{stageOptions.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type" required value={educationType} onChange={e=>setEducationType(e.target.value)} disabled={!stage}><option value="">اختر نوع التعليم</option>{(types[stage]||[]).map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>الصف / الفرقة</label><select className="input" name="grade" required disabled={!stage} defaultValue=""><option value="">اختر الصف</option>{gradeOptions.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>المدرسة / الكلية (اختياري)</label><input className="input" name="school_name"/></div></div><div className="wizard-actions"><button type="button" className="btn" onClick={()=>setStep(1)}>السابق</button><button type="button" className="btn btn-dark" disabled={!stage||!educationType} onClick={()=>setStep(3)}>التالي</button></div></div>}
  {step===3&&<div><span className="eyebrow">الخطوة 3 من 3</span><h1>الدخول والأمان</h1><div className="form-grid"><div className="field"><label>البريد الإلكتروني</label><input className="input" type="email" name="email" required/></div><div className="field"><label>كلمة المرور</label><input className="input" type="password" name="password" required minLength={8}/></div><div className="field"><label>تأكيد كلمة المرور</label><input className="input" type="password" name="confirm" required/></div></div><p style={{fontSize:13,color:'var(--muted)'}}>استخدم 8 أحرف على الأقل، وحرفًا كبيرًا وصغيرًا ورقمًا.</p><div className="wizard-actions"><button type="button" className="btn" onClick={()=>setStep(2)}>السابق</button><button className="btn btn-dark">إنشاء الحساب</button></div></div>}
  {msg&&<p className="notice error">{msg}</p>}
 </form></main></>;
}
