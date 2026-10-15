'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AcceptAdmin() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) {
      setMsg('كلمتا المرور غير متطابقتين');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api('/auth/admin-invite/accept', {
        method: 'POST',
        body: JSON.stringify({
          token,
          first_name: form.get('first_name'),
          last_name: form.get('last_name'),
          phone: form.get('phone'),
          password: form.get('password'),
        }),
      });
      router.replace('/admin/login');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'تعذر قبول الدعوة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-screen">
      <section className="admin-login-card admin-accept-card">
        <div className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid" /></div>
        <span className="admin-login-kicker">Secure Administration</span>
        <h1>تفعيل حساب الأدمن</h1>
        <p>أكمل بياناتك لإنشاء حساب الإدارة من رابط الدعوة.</p>

        <form className="admin-login-form" onSubmit={submit}>
          <div className="admin-accept-grid">
            <div>
              <label>الاسم الأول</label>
              <input name="first_name" required />
            </div>
            <div>
              <label>الاسم الأخير</label>
              <input name="last_name" required />
            </div>
          </div>
          <label>رقم الهاتف</label>
          <input name="phone" inputMode="tel" required />
          <label>كلمة المرور</label>
          <input type="password" name="password" autoComplete="new-password" minLength={8} required />
          <label>تأكيد كلمة المرور</label>
          <input type="password" name="confirm" autoComplete="new-password" minLength={8} required />
          <button type="submit" disabled={!token || busy}>{busy ? 'جاري التفعيل...' : 'تفعيل حساب الأدمن'}</button>
        </form>

        {!token && <div className="admin-login-message">رابط الدعوة غير مكتمل أو لا يحتوي على Token.</div>}
        {msg && <div className="admin-login-message">{msg}</div>}
        <Link href="/admin/login" className="admin-login-back">العودة لدخول الإدارة</Link>
      </section>
    </main>
  );
}
