'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [message, setMessage] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const r = await api<{message:string;dev_code?:string}>('/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email })
      });
      setMessage(r.message || 'لو الإيميل مسجل هيوصله كود التحقق.');
      setDevCode(r.dev_code || '');
      setStep('reset');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذر إرسال الكود.');
    } finally { setBusy(false); }
  }

  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('');
    const f = new FormData(e.currentTarget);
    const pass = String(f.get('new_password') || '');
    const confirm = String(f.get('confirm_password') || '');
    if (pass !== confirm) { setMessage('كلمتا المرور غير متطابقتين.'); setBusy(false); return; }
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: f.get('code'), new_password: pass })
      });
      setMessage('تم تغيير كلمة السر بنجاح.');
      window.setTimeout(() => router.replace('/login'), 700);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذر تغيير كلمة السر.');
    } finally { setBusy(false); }
  }

  return <><Header/><main className="auth-wrap">
    {step === 'request' ? <form className="card auth-card" onSubmit={requestCode}>
      <span className="eyebrow">استعادة الحساب</span><h1>نسيت كلمة السر؟</h1>
      <p>اكتب الإيميل المسجل في حساب الطالب، وهيوصلك كود مكوّن من 6 أرقام.</p>
      <div className="field"><label>البريد الإلكتروني</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
      <button className="btn btn-dark" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'جاري الإرسال...':'طلب كود التحقق'}</button>
      {message&&<p className="notice">{message}</p>}
      <Link className="auth-secondary-link" href="/login">العودة لتسجيل الدخول</Link>
    </form> : <form className="card auth-card" onSubmit={resetPassword}>
      <span className="eyebrow">كود التحقق</span><h1>اختار كلمة سر جديدة</h1>
      <p>بعتنا الكود للإيميل <b dir="ltr">{email}</b>. الكود صالح لفترة قصيرة ويستخدم مرة واحدة.</p>
      <div className="field"><label>الكود</label><input className="input otp-input" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={devCode} required/></div>
      <div className="field" style={{marginTop:12}}><label>كلمة السر الجديدة</label><input className="input" type="password" name="new_password" required/></div>
      <div className="field" style={{marginTop:12}}><label>تأكيد كلمة السر</label><input className="input" type="password" name="confirm_password" required/></div>
      {devCode&&<p className="notice">وضع التطوير فقط — الكود: {devCode}</p>}
      <button className="btn btn-dark" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'جاري الحفظ...':'تغيير كلمة السر'}</button>
      {message&&<p className="notice">{message}</p>}
      <button type="button" className="btn" style={{width:'100%'}} onClick={()=>setStep('request')}>طلب كود جديد</button>
    </form>}
  </main></>;
}
