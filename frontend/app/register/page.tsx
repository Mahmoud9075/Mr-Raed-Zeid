'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const ALL_STAGES = ['إعدادي', 'ثانوي', 'كورسات للكبار'] as const;
const educationTypes: Record<string, string[]> = {
  'إعدادي': ['عام', 'أزهري'],
  'ثانوي': ['عام', 'أزهري', 'فني صناعي', 'تجاري', 'زراعي'],
  'كورسات للكبار': ['كورسات عامة']
};
const grades: Record<string, string[]> = {
  'إعدادي': ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'],
  'ثانوي': ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
  'كورسات للكبار': ['كورسات للكبار']
};

type FormState = {
  first_name: string; last_name: string; phone: string; guardian_phone: string;
  stage: string; education_type: string; grade: string; school_name: string;
  email: string; password: string; confirm: string;
};

const INITIAL: FormState = { first_name: '', last_name: '', phone: '', guardian_phone: '', stage: '', education_type: '', grade: '', school_name: '', email: '', password: '', confirm: '' };

export default function Register() {
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [enabledStages, setEnabledStages] = useState<string[]>([...ALL_STAGES]);
  const router = useRouter();
  const gradeOptions = useMemo(() => grades[form.stage] || [], [form.stage]);

  useEffect(() => {
    api<Record<string,string>>('/site-settings').then((settings) => {
      const available = ALL_STAGES.filter((stage) => {
        if (stage === 'إعدادي') return settings.stage_prep_enabled !== 'false';
        if (stage === 'ثانوي') return settings.stage_secondary_enabled !== 'false';
        return settings.stage_adults_enabled !== 'false';
      });
      setEnabledStages([...available]);
      if (form.stage && !available.includes(form.stage as typeof ALL_STAGES[number])) {
        setForm((old) => ({ ...old, stage: '', education_type: '', grade: '' }));
      }
    }).catch(() => {});
  }, [form.stage]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function nextFromStudent() {
    if (!form.first_name.trim() || !form.last_name.trim() || form.phone.trim().length < 8) {
      setMessage('اكتب اسم الطالب ورقم الموبايل بشكل صحيح.'); return;
    }
    setMessage(''); setStep(2);
  }

  function nextFromStage() {
    if (!form.stage || !form.education_type || !form.grade) {
      setMessage('اختار المرحلة ونوع التعليم والصف.'); return;
    }
    setMessage(''); setStep(3);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (form.password !== form.confirm) { setMessage('كلمتا المرور غير متطابقتين'); return; }
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone,
          guardian_phone: form.guardian_phone || null, stage: form.stage, education_type: form.education_type,
          grade: form.grade, school_name: form.school_name || null, password: form.password
        })
      });
      router.push('/login?registered=1');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'راجع البيانات وجرب إنشاء الحساب مرة تانية.');
    }
  }

  return (
    <><Header/><main className="auth-wrap"><form className="card auth-card wizard-card" onSubmit={submit}>
      <div className="auth-tabs"><Link href="/login">دخول</Link><Link className="active" href="/register">حساب جديد</Link></div>
      <div className="wizard-progress"><span className={step >= 1 ? 'on' : ''}>1</span><i/><span className={step >= 2 ? 'on' : ''}>2</span><i/><span className={step >= 3 ? 'on' : ''}>3</span></div>

      {step === 1 && <div><span className="eyebrow">الخطوة 1 من 3</span><h1>بيانات الطالب</h1><div className="form-grid">
        <div className="field"><label>الاسم الأول</label><input className="input" value={form.first_name} onChange={(e)=>set('first_name',e.target.value)} required/></div>
        <div className="field"><label>الاسم الأخير</label><input className="input" value={form.last_name} onChange={(e)=>set('last_name',e.target.value)} required/></div>
        <div className="field"><label>رقم موبايل الطالب</label><input className="input" value={form.phone} onChange={(e)=>set('phone',e.target.value)} inputMode="tel" required/></div>
        <div className="field"><label>رقم ولي الأمر</label><input className="input" value={form.guardian_phone} onChange={(e)=>set('guardian_phone',e.target.value)} inputMode="tel"/></div>
      </div><button type="button" className="btn btn-dark wizard-full" onClick={nextFromStudent}>التالي</button></div>}

      {step === 2 && <div><span className="eyebrow">الخطوة 2 من 3</span><h1>المرحلة الدراسية</h1>{enabledStages.length===0 && <p className="notice error">إنشاء حسابات جديدة موقوف مؤقتًا لكل المراحل.</p>}<div className="form-grid">
        <div className="field"><label>المرحلة</label><select className="input" required value={form.stage} onChange={(e)=>setForm((old)=>({...old,stage:e.target.value,education_type:'',grade:''}))}><option value="">اختر المرحلة</option>{enabledStages.map((item)=><option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>نوع التعليم</label><select className="input" required value={form.education_type} onChange={(e)=>set('education_type',e.target.value)} disabled={!form.stage}><option value="">اختر نوع التعليم</option>{(educationTypes[form.stage]||[]).map((item)=><option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>الصف</label><select className="input" required value={form.grade} onChange={(e)=>set('grade',e.target.value)} disabled={!form.stage}><option value="">اختر الصف</option>{gradeOptions.map((item)=><option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>المدرسة (اختياري)</label><input className="input" value={form.school_name} onChange={(e)=>set('school_name',e.target.value)}/></div>
      </div><div className="wizard-actions"><button type="button" className="btn" onClick={()=>{setMessage('');setStep(1)}}>السابق</button><button type="button" className="btn btn-dark" disabled={!enabledStages.length} onClick={nextFromStage}>التالي</button></div></div>}

      {step === 3 && <div><span className="eyebrow">الخطوة 3 من 3</span><h1>الدخول والأمان</h1><div className="form-grid">
        <div className="field field-span"><label>البريد الإلكتروني</label><input className="input" type="email" value={form.email} onChange={(e)=>set('email',e.target.value)} required/></div>
        <div className="field"><label>كلمة المرور</label><input className="input" type="password" value={form.password} onChange={(e)=>set('password',e.target.value)} required minLength={8}/></div>
        <div className="field"><label>تأكيد كلمة المرور</label><input className="input" type="password" value={form.confirm} onChange={(e)=>set('confirm',e.target.value)} required/></div>
      </div><p className="form-hint">استخدم 8 أحرف على الأقل، وتكون كلمة المرور فيها حرف كبير وحرف صغير ورقم.</p><div className="wizard-actions"><button type="button" className="btn" onClick={()=>{setMessage('');setStep(2)}}>السابق</button><button className="btn btn-dark">إنشاء الحساب</button></div></div>}
      {message && <p className="notice error">{message}</p>}
    </form></main></>
  );
}
