'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminForgotPinPage(){
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [step,setStep]=useState<'request'|'reset'>('request');
  const [message,setMessage]=useState('');
  const [devCode,setDevCode]=useState('');
  const [busy,setBusy]=useState(false);

  async function requestCode(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');
    try{const r=await api<{message:string;dev_code?:string}>('/auth/admin-pin/forgot',{method:'POST',body:JSON.stringify({email})});setMessage(r.message);setDevCode(r.dev_code||'');setStep('reset')}
    catch(err){setMessage(err instanceof Error?err.message:'تعذر إرسال الكود.')}
    finally{setBusy(false)}
  }

  async function resetPin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);const pin=String(f.get('pin')||'');
    if(pin!==String(f.get('confirm_pin')||'')){setMessage('رقما الـ PIN غير متطابقين.');return}
    setBusy(true);setMessage('');
    try{await api('/auth/admin-pin/reset',{method:'POST',body:JSON.stringify({email,code:f.get('code'),pin})});setMessage('تم تغيير PIN الإدارة. تقدر تدخل بالرقم الجديد.');setTimeout(()=>router.replace('/admin/login'),700)}
    catch(err){setMessage(err instanceof Error?err.message:'تعذر تغيير PIN.')}
    finally{setBusy(false)}
  }

  return <main className="admin-login-screen"><section className="admin-login-card">
    <Link href="/" className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/></Link>
    <span className="admin-login-kicker">ADMIN PIN RECOVERY</span>
    {step==='request'?<form className="admin-login-form" onSubmit={requestCode}>
      <h1>نسيت PIN الإدارة؟</h1><p>اكتب إيميل الأدمن المعتمد، وهيوصلك كود 6 أرقام لو الحساب مسجل ومسموح له.</p>
      <label>إيميل الإدارة</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <button disabled={busy}>{busy?'جاري الإرسال...':'إرسال كود التحقق'}</button>
    </form>:<form className="admin-login-form" onSubmit={resetPin}>
      <h1>PIN جديد</h1><p>الكود صالح لمدة 10 دقائق ويُستخدم مرة واحدة.</p>
      <label>الكود</label><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={devCode} required/>
      <label>PIN الجديد</label><input type="password" name="pin" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required/>
      <label>تأكيد PIN</label><input type="password" name="confirm_pin" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required/>
      {devCode&&<small>وضع التطوير فقط — الكود: {devCode}</small>}
      <button disabled={busy}>{busy?'جاري الحفظ...':'حفظ PIN الجديد'}</button>
      <button type="button" className="admin-login-ghost" onClick={()=>setStep('request')}>طلب كود جديد</button>
    </form>}
    {message&&<div className="admin-login-message">{message}</div>}
    <Link href="/admin/login" className="admin-login-back">العودة لدخول الإدارة</Link>
  </section></main>;
}
