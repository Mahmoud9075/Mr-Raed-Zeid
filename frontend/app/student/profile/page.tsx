'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, assetUrl } from '@/lib/api';

type Me = { id: number; first_name: string; last_name: string; email: string; phone: string; guardian_phone?: string; stage?: string; education_type?: string; grade?: string; school_name?: string; profile_image?: string; role: string };
const stages = ['إعدادي', 'ثانوي', 'كورسات للكبار'];
const types: Record<string, string[]> = { 'إعدادي': ['عام', 'أزهري'], 'ثانوي': ['عام', 'أزهري', 'فني صناعي', 'تجاري', 'زراعي'], 'كورسات للكبار': ['كورسات عامة'] };
const grades: Record<string, string[]> = { 'إعدادي': ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'], 'ثانوي': ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'], 'كورسات للكبار': ['كورسات للكبار'] };

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<Me>('/auth/me').then(setMe).catch(() => setMessage('سجّل دخولك علشان تفتح بيانات حسابك.'));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const user = await api<Me>('/auth/profile', { method: 'PUT', body: JSON.stringify({ first_name: form.get('first_name'), last_name: form.get('last_name'), guardian_phone: form.get('guardian_phone'), stage: form.get('stage'), education_type: form.get('education_type'), grade: form.get('grade'), school_name: form.get('school_name') }) });
      setMe(user);
      setMessage('تم حفظ التعديلات بنجاح.');
    } catch {
      setMessage('راجع البيانات وجرب الحفظ مرة تانية.');
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const user = await api<Me>('/auth/profile/image', { method: 'POST', body: form });
      setMe(user);
      setMessage('تم تحديث الصورة.');
    } catch {
      setMessage('الصورة ما اترفعتش. جرب صورة JPG أو PNG أصغر.');
    }
  }

  if (!me) return <><Header /><main className="auth-wrap"><div className="card loading-card">{message || 'جاري تحميل الحساب...'}</div></main></>;

  return (
    <><Header /><main className="section"><div className="container profile-layout">
      <aside className="card profile-summary"><div className="profile-avatar">{me.profile_image ? <img src={assetUrl(me.profile_image)} alt="الصورة الشخصية" /> : <span>{me.first_name.charAt(0)}</span>}</div><h2>{me.first_name} {me.last_name}</h2><p>{me.email}</p><label className="btn upload-btn">تغيير الصورة<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => upload(event.target.files?.[0])} /></label><Link className="btn btn-dark" href="/student">العودة للوحة الطالب</Link></aside>
      <form className="card profile-form" onSubmit={save}><span className="eyebrow">حسابي</span><h1 className="section-title">بيانات الطالب</h1><div className="form-grid"><div className="field"><label>الاسم الأول</label><input className="input" name="first_name" defaultValue={me.first_name} /></div><div className="field"><label>الاسم الأخير</label><input className="input" name="last_name" defaultValue={me.last_name} /></div><div className="field"><label>رقم الطالب</label><input className="input" value={me.phone} disabled /></div><div className="field"><label>رقم ولي الأمر</label><input className="input" name="guardian_phone" defaultValue={me.guardian_phone || ''} /></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={me.stage || ''} onChange={(event) => setMe({ ...me, stage: event.target.value, education_type: '', grade: '' })}><option value="">اختر المرحلة</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type" value={me.education_type || ''} onChange={(event) => setMe({ ...me, education_type: event.target.value })}><option value="">اختر نوع التعليم</option>{(types[me.stage || ''] || []).map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade" value={me.grade || ''} onChange={(event) => setMe({ ...me, grade: event.target.value })}><option value="">اختر الصف</option>{(grades[me.stage || ''] || []).map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label>المدرسة</label><input className="input" name="school_name" defaultValue={me.school_name || ''} /></div></div><button className="btn btn-dark profile-save">حفظ التعديلات</button>{message && <p className="notice">{message}</p>}</form>
    </div></main></>
  );
}
