'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

type Result = { type:string; title:string; subtitle:string; href:string };

export default function Search() {
  const [results,setResults] = useState<Result[]>([]);
  const [searched,setSearched] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const q = String(f.get('q') || '').trim();
    if (q.length < 2 || busy) return;

    setBusy(true);
    setError('');
    try {
      setResults(await api<Result[]>(`/search?q=${encodeURIComponent(q)}`));
      setSearched(true);
    } catch (e) {
      setResults([]);
      setSearched(false);
      setError(e instanceof Error ? e.message : 'تعذر البحث. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  const needsLogin = /تسجيل الدخول|جلسة|غير مصرح|Unauthorized/i.test(error);

  return <>
    <Header/>
    <main className="section">
      <div className="container search-page">
        <div className="assistant-head">
          <div>
            <span className="eyebrow">بحث الموقع</span>
            <h1 className="section-title">دور على اللي محتاجه بسرعة</h1>
          </div>
          <Link className="btn" href="/student">لوحة الطالب</Link>
        </div>
        <form className="search-form" onSubmit={submit}>
          <input className="input" name="q" placeholder="مثال: تحديد المستوى، المواعيد، الاشتراك..." aria-label="بحث الموقع"/>
          <button className="btn btn-dark" disabled={busy}>{busy ? 'جاري البحث...' : 'بحث'}</button>
        </form>
        {error && (
          <div className="notice error" role="alert">
            {needsLogin ? <>لازم تسجل دخولك بحساب الطالب علشان تستخدم البحث. <Link href="/login"><b>تسجيل الدخول</b></Link></> : error}
          </div>
        )}
        <div className="search-results">
          {searched && results.length === 0
            ? <div className="card" style={{padding:24}}>مفيش نتائج مطابقة.</div>
            : results.map((r,i) => <Link className="card search-result" href={r.href} key={`${r.type}-${r.href}-${i}`}><span className="eyebrow">{r.type === 'quiz' ? 'اختبار' : 'معلومة'}</span><h3>{r.title}</h3><p>{r.subtitle}</p></Link>)}
        </div>
      </div>
    </main>
  </>;
}
