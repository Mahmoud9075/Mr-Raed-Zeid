'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Mode = 'pin' | 'email' | 'password';

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('pin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [emailStep, setEmailStep] = useState<'request'|'verify'>('request');
  const [adminEmail, setAdminEmail] = useState('');
  const [devCode, setDevCode] = useState('');

  useEffect(() => {
    api<{ role: string }>('/auth/me').then(me => {
      if (['admin','owner'].includes(me.role)) router.replace('/admin');
    }).catch(() => {});
  }, [router]);

  async function finishLogin() {
    const me = await api<{ role: string }>('/auth/me');
    if (!['admin','owner'].includes(me.role)) throw new Error('الحساب ده مش مخصص للإدارة.');
    router.replace('/admin');
  }

  async function submitPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const f = new FormData(event.currentTarget);
    try {
      await api('/auth/admin-pin', {method:'POST',body:JSON.stringify({pin:f.get('pin')})});
      await finishLogin();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'الرقم السري غير صحيح.'); }
    finally { setBusy(false); }
  }

  async function requestEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const r = await api<{message:string;dev_code?:string}>('/auth/admin-email/request', {method:'POST',body:JSON.stringify({email:adminEmail})});
      setDevCode(r.dev_code || ''); setEmailStep('verify'); setMessage(r.message || 'لو الإيميل مسجل كأدمن هيوصله كود التحقق.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذر إرسال الكود.'); }
    finally { setBusy(false); }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const f = new FormData(event.currentTarget);
    try {
      await api('/auth/admin-email/verify', {method:'POST',body:JSON.stringify({email:adminEmail,code:f.get('code')})});
      await finishLogin();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'الكود غير صحيح أو انتهت صلاحيته.'); }
    finally { setBusy(false); }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const f = new FormData(event.currentTarget);
    try {
      const r = await api<{requires_otp?:boolean;challenge_id?:number}>('/auth/login',{method:'POST',body:JSON.stringify({identifier:f.get('identifier'),password:f.get('password')})});
      if(r.requires_otp && r.challenge_id){ setChallengeId(r.challenge_id); setMessage('بعتنا كود تحقق إضافي على إيميل الإدارة.'); }
      else await finishLogin();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'بيانات الدخول غير صحيحة.'); }
    finally { setBusy(false); }
  }

  async function verifyPasswordOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const f = new FormData(event.currentTarget);
    try { await api('/auth/admin-otp',{method:'POST',body:JSON.stringify({challenge_id:challengeId,code:f.get('code')})}); await finishLogin(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'الكود غير صحيح.'); }
    finally { setBusy(false); }
  }

  function switchMode(next:Mode){ setMode(next); setMessage(''); setChallengeId(null); setEmailStep('request'); setDevCode(''); }

  return <main className="admin-login-screen"><section className="admin-login-card">
    <Link href="/" className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/></Link>
    <span className="admin-login-kicker">SUPER ADMIN CONTROL CENTER</span>
    <h1>دخول لوحة الإدارة</h1><p>اختر طريقة الدخول المناسبة. كل المحاولات محمية ومحدودة.</p>
    <div className="admin-login-tabs">
      <button className={mode==='pin'?'active':''} onClick={()=>switchMode('pin')}>PIN</button>
      <button className={mode==='email'?'active':''} onClick={()=>switchMode('email')}>كود الإيميل</button>
      <button className={mode==='password'?'active':''} onClick={()=>switchMode('password')}>كلمة السر</button>
    </div>

    {mode==='pin' && <form onSubmit={submitPin} className="admin-login-form">
      <label>الرقم السري للإدارة — 6 أرقام</label><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/>
      <button disabled={busy}>{busy?'جاري التحقق...':'دخول بالـ PIN'}</button>
      <Link className="admin-login-ghost" href="/admin/forgot-pin">نسيت الـ PIN؟ غيّره بكود الإيميل</Link>
    </form>}

    {mode==='email' && emailStep==='request' && <form onSubmit={requestEmailCode} className="admin-login-form">
      <label>إيميل الأدمن المعتمد</label><input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required/>
      <button disabled={busy}>{busy?'جاري الإرسال...':'إرسال كود 6 أرقام'}</button>
    </form>}
    {mode==='email' && emailStep==='verify' && <form onSubmit={verifyEmailCode} className="admin-login-form">
      <label>كود التحقق</label><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={devCode} required/>
      {devCode&&<small>وضع التطوير فقط — الكود: {devCode}</small>}
      <button disabled={busy}>{busy?'جاري التحقق...':'تأكيد ودخول'}</button>
      <button type="button" className="admin-login-ghost" onClick={()=>setEmailStep('request')}>طلب كود جديد</button>
    </form>}

    {mode==='password' && !challengeId && <form onSubmit={submitPassword} className="admin-login-form">
      <label>البريد الإلكتروني أو رقم الهاتف</label><input name="identifier" autoComplete="username" required/>
      <label>كلمة المرور</label><input name="password" type="password" autoComplete="current-password" required/>
      <button disabled={busy}>{busy?'جاري التحقق...':'دخول آمن'}</button>
      <Link className="admin-forgot" href="/admin/forgot-password">نسيت كلمة السر؟</Link>
    </form>}
    {mode==='password' && challengeId && <form onSubmit={verifyPasswordOtp} className="admin-login-form">
      <label>كود التحقق الإضافي</label><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required/>
      <button disabled={busy}>{busy?'جاري التحقق...':'تأكيد الكود'}</button>
    </form>}

    {message&&<div className="admin-login-message">{message}</div>}
    <Link href="/" className="admin-login-back">العودة للموقع</Link>
  </section></main>;
}
