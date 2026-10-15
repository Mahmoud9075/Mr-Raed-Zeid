'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState<number | null>(null);

  useEffect(() => {
    api<{ role: string }>('/auth/me')
      .then((me) => {
        if (['admin', 'owner'].includes(me.role)) router.replace('/admin');
      })
      .catch(() => {});
  }, [router]);

  async function finishLogin() {
    const me = await api<{ role: string }>('/auth/me');
    if (!['admin', 'owner'].includes(me.role)) {
      setMessage('الحساب ده مش مخصص للإدارة.');
      return;
    }
    router.replace('/admin');
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await api<{ requires_otp?: boolean; challenge_id?: number }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') })
      });
      if (response.requires_otp && response.challenge_id) {
        setChallengeId(response.challenge_id);
      } else {
        await finishLogin();
      }
    } catch {
      setMessage('بيانات الدخول غير صحيحة أو الحساب غير متاح.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/admin-otp', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: challengeId, code: form.get('code') })
      });
      await finishLogin();
    } catch {
      setMessage('كود التحقق غير صحيح أو انتهت صلاحيته.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-screen">
      <section className="admin-login-card">
        <Link href="/" className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid" /></Link>
        <span className="admin-login-kicker">Secure Administration</span>
        <h1>دخول لوحة الإدارة</h1>
        <p>الصفحة دي مخصصة لمستر رائد والأدمنز المعتمدين فقط.</p>

        {!challengeId ? (
          <form onSubmit={submitLogin} className="admin-login-form">
            <label>البريد الإلكتروني أو رقم الهاتف</label>
            <input name="identifier" autoComplete="username" required />
            <label>كلمة المرور</label>
            <input name="password" type="password" autoComplete="current-password" required />
            <button type="submit" disabled={busy}>{busy ? 'جاري التحقق...' : 'دخول آمن'}</button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="admin-login-form">
            <label>كود التحقق</label>
            <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
            <button type="submit" disabled={busy}>{busy ? 'جاري التحقق...' : 'تأكيد الكود'}</button>
          </form>
        )}

        {message && <div className="admin-login-message">{message}</div>}
        <Link href="/" className="admin-login-back">العودة للموقع</Link>
      </section>
    </main>
  );
}
