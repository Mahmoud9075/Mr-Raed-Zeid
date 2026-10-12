'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const stages = ['إعدادي', 'ثانوي', 'كورسات للكبار'];
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

export default function Register() {
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState('');
  const [educationType, setEducationType] = useState('');
  const [step, setStep] = useState(1);
  const router = useRouter();
  const gradeOptions = useMemo(() => grades[stage] || [], [stage]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) {
      setMessage('كلمتا المرور غير متطابقتين');
      return;
    }
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: form.get('first_name'),
          last_name: form.get('last_name'),
          email: form.get('email'),
          phone: form.get('phone'),
          guardian_phone: form.get('guardian_phone'),
          stage: form.get('stage'),
          education_type: form.get('education_type'),
          grade: form.get('grade'),
          school_name: form.get('school_name'),
          password: form.get('password')
        })
      });
      router.push('/login');
    } catch {
      setMessage('راجع البيانات وجرب إنشاء الحساب مرة تانية.');
    }
  }

  return (
    <>
      <Header />
      <main className="auth-wrap">
        <form className="card auth-card wizard-card" onSubmit={submit}>
          <div className="auth-tabs"><Link href="/login">دخول</Link><Link className="active" href="/register">حساب جديد</Link></div>
          <div className="wizard-progress"><span className={step >= 1 ? 'on' : ''}>1</span><i/><span className={step >= 2 ? 'on' : ''}>2</span><i/><span className={step >= 3 ? 'on' : ''}>3</span></div>

          {step === 1 && <div><span className="eyebrow">الخطوة 1 من 3</span><h1>بيانات الطالب</h1><div className="form-grid"><div className="field"><label>الاسم الأول</label><input className="input" name="first_name" required /></div><div className="field"><label>الاسم الأخير</label><input className="input" name="last_name" required /></div><div className="field"><label>رقم موبايل الطالب</label><input className="input" name="phone" inputMode="tel" required /></div><div className="field"><label>رقم ولي الأمر</label><input className="input" name="guardian_phone" inputMode="tel" /></div></div><button type="button" className="btn btn-dark wizard-full" onClick={() => setStep(2)}>التالي</button></div>}

          {step === 2 && <div><span className="eyebrow">الخطوة 2 من 3</span><h1>المرحلة الدراسية</h1><div className="form-grid"><div className="field"><label>المرحلة</label><select className="input" name="stage" required value={stage} onChange={(event) => { setStage(event.target.value); setEducationType(''); }}><option value="">اختر المرحلة</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type" required value={educationType} onChange={(event) => setEducationType(event.target.value)} disabled={!stage}><option value="">اختر نوع التعليم</option>{(educationTypes[stage] || []).map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade" required disabled={!stage} defaultValue=""><option value="">اختر الصف</option>{gradeOptions.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>المدرسة (اختياري)</label><input className="input" name="school_name" /></div></div><div className="wizard-actions"><button type="button" className="btn" onClick={() => setStep(1)}>السابق</button><button type="button" className="btn btn-dark" disabled={!stage || !educationType} onClick={() => setStep(3)}>التالي</button></div></div>}

          {step === 3 && <div><span className="eyebrow">الخطوة 3 من 3</span><h1>الدخول والأمان</h1><div className="form-grid"><div className="field"><label>البريد الإلكتروني</label><input className="input" type="email" name="email" required /></div><div className="field"><label>كلمة المرور</label><input className="input" type="password" name="password" required minLength={8} /></div><div className="field"><label>تأكيد كلمة المرور</label><input className="input" type="password" name="confirm" required /></div></div><p className="form-hint">استخدم 8 أحرف على الأقل مع حرف ورقم.</p><div className="wizard-actions"><button type="button" className="btn" onClick={() => setStep(2)}>السابق</button><button className="btn btn-dark">إنشاء الحساب</button></div></div>}

          {message && <p className="notice error">{message}</p>}
        </form>
      </main>
    </>
  );
}
