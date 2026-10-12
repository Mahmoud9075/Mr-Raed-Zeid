'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Message = { id: number; role: 'user' | 'assistant'; text: string };
const quick = ['مواعيد السنتر إيه؟', 'فين مكان السنتر؟', 'إزاي أحجز؟', 'الاشتراك بكام؟', 'درجتي كام؟', 'اشرحلي قاعدة في الجرامر', 'إيه معنى كلمة بالإنجليزي؟'];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'assistant', text: 'أهلًا! أنا مساعد مستر رائد. اسألني عن المواعيد والحجز والإنجليزي والقواعد والاختبارات ونتائجك.' }]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }));
  }, [messages, busy]);

  function add(role: Message['role'], text: string) {
    const id = nextId.current++;
    setMessages((items) => [...items, { id, role, text }]);
  }

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));
    add('user', text);
    setDraft('');
    setBusy(true);
    try {
      const response = await api<{ answer: string }>('/assistant/chat', { method: 'POST', body: JSON.stringify({ message: text, history }) });
      add('assistant', response.answer?.trim() || 'ممكن تعيد سؤالك بطريقة أبسط شوية؟');
    } catch {
      add('assistant', 'المعلومة دي محتاجة تأكيد مباشر من مستر رائد. تقدر تتواصل معاه من زر واتساب.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(draft);
  }

  return (
    <>
      <Header />
      <main className="section assistant-page">
        <div className="container assistant-shell">
          <div className="assistant-head"><div><span className="eyebrow">اسأل مساعد مستر رائد</span><h1 className="section-title">إجابة مرتبة من داخل المنصة</h1></div><Link className="btn" href="/student">لوحة الطالب</Link></div>
          <div className="quick-prompts">{quick.map((item) => <button key={item} type="button" onClick={() => ask(item)} disabled={busy}>{item}</button>)}</div>
          <div className="card chat-box" ref={bodyRef} aria-live="polite">{messages.map((item) => <div key={item.id} className={`chat-msg ${item.role === 'user' ? 'me' : 'bot'}`}><span>{item.text}</span></div>)}{busy && <div className="chat-msg bot"><span>بجهزلك الرد...</span></div>}</div>
          <form className="chat-input" onSubmit={submit}><input className="input" name="message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="اكتب سؤالك هنا..." autoComplete="off" disabled={busy} /><button className="btn btn-dark" type="submit" disabled={busy || !draft.trim()}>إرسال</button></form>
          <p className="assistant-note">بيانات مستر رائد بتتجاب من المعلومات المعتمدة، وأسئلة المنهج والإنجليزي بتتحول للمساعد الذكي عند الحاجة.</p>
        </div>
      </main>
    </>
  );
}
