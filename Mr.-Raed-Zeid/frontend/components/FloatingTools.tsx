'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

type Message = { id: number; role: 'user' | 'assistant'; text: string };
type AssistantResponse = { answer: string; source?: string };

const QUICK_PROMPTS_AR = ['مواعيد السنتر إيه؟', 'الاشتراك بكام؟', 'فين مكان السنتر؟', 'إزاي أحجز؟', 'اشرحلي قاعدة في الجرامر', 'إيه معنى الكلمة دي؟'];
const QUICK_PROMPTS_EN = ['Center hours?', 'How much is the fee?', 'Where is the center?', 'How can I book?', 'Explain a grammar rule', 'What does this word mean?'];

export default function FloatingTools() {
  const pathname = usePathname();
  const en = pathname.startsWith('/en');
  const quickPrompts = en ? QUICK_PROMPTS_EN : QUICK_PROMPTS_AR;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'assistant', text: en ? 'Hi! I am Mr. Raed Assistant. Ask me about schedules, fees, booking, English, or the curriculum.' : 'أهلًا! أنا مساعد مستر رائد. اسألني عن المواعيد، الأسعار، الحجز، الإنجليزي أو المنهج.' }]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }));
  }, [messages, busy, open]);

  useEffect(() => {
    document.body.classList.toggle('chat-is-open', open);
    if (open) setTimeout(() => inputRef.current?.focus(), 180);
    return () => document.body.classList.remove('chat-is-open');
  }, [open]);

  function addMessage(role: Message['role'], text: string) {
    const id = nextId.current++;
    setMessages((items) => [...items, { id, role, text }]);
  }

  async function ask(rawText: string) {
    const message = rawText.trim();
    if (!message || busy) return;

    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));
    addMessage('user', message);
    setDraft('');
    setBusy(true);

    try {
      const response = await api<AssistantResponse>('/assistant/chat', { method: 'POST', body: JSON.stringify({ message, history }) });
      addMessage('assistant', response.answer?.trim() || (en ? 'Could you ask that in a simpler way?' : 'ممكن تعيد سؤالك بطريقة أبسط شوية؟'));
    } catch {
      addMessage('assistant', en ? 'This needs direct confirmation from Mr. Raed. You can contact him using the WhatsApp button.' : 'المعلومة دي محتاجة تأكيد مباشر من مستر رائد. تقدر تتواصل معاه من زر واتساب.');
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
      {!open && <div className="floating-tools" aria-label="إجراءات سريعة">
        <a className="floating-action floating-whatsapp" href="https://wa.me/201033246113" target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.01 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.93 9.93 0 0 0 12.01 22C17.53 22 22 17.52 22 12S17.53 2 12.01 2Zm0 18.06c-1.63 0-3.15-.46-4.45-1.25l-.32-.19-3.01.79.8-2.93-.21-.3A8.02 8.02 0 0 1 4 12c0-4.42 3.59-8 8.01-8 4.41 0 8 3.58 8 8s-3.59 8.06-8 8.06Z"/></svg>
        </a>
        <button className="floating-action floating-chat" type="button" onClick={() => setOpen(true)} aria-label="فتح مساعد مستر رائد" title="اسأل مساعد مستر رائد">
          <span className="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.75h14A2.25 2.25 0 0 1 21.25 7v8A2.25 2.25 0 0 1 19 17.25h-7.05L7.3 20.7a.75.75 0 0 1-1.2-.6v-2.85H5A2.25 2.25 0 0 1 2.75 15V7A2.25 2.25 0 0 1 5 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7.2 10.95h.01M12 10.95h.01M16.8 10.95h.01" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg></span>
          <span className="floating-label">اسأل مساعد مستر رائد</span>
        </button>
      </div>}

      {open && <div className="chat-overlay" role="dialog" aria-modal="true" aria-label={en ? 'Mr. Raed Assistant' : 'مساعد مستر رائد'}>
        <button className="chat-overlay-backdrop" aria-label={en ? 'Close' : 'إغلاق'} onClick={() => setOpen(false)} />
        <section className="chat-drawer" dir={en ? 'ltr' : 'rtl'}>
          <header className="chat-drawer-head">
            <div className="chat-drawer-title"><span className="chat-head-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.75h14A2.25 2.25 0 0 1 21.25 7v8A2.25 2.25 0 0 1 19 17.25h-7.05L7.3 20.7a.75.75 0 0 1-1.2-.6v-2.85H5A2.25 2.25 0 0 1 2.75 15V7A2.25 2.25 0 0 1 5 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></span><div><span className="chat-drawer-kicker">Mr. Raed Assistant</span><h2>{en ? 'Ask Mr. Raed Assistant' : 'اسأل مساعد مستر رائد'}</h2><p>{en ? 'Schedules, fees, booking, English and curriculum.' : 'مواعيد، أسعار، حجز، إنجليزي ومنهج.'}</p></div></div>
            <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label={en ? 'Close' : 'إغلاق'}>×</button>
          </header>

          <div className="chat-quick-row" aria-label={en ? 'Quick questions' : 'أسئلة سريعة'}>{quickPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={busy}>{prompt}</button>)}</div>

          <div className="chat-drawer-body" ref={bodyRef} aria-live="polite">{messages.map((item) => <div key={item.id} className={`assistant-message ${item.role}`}><span>{item.text}</span></div>)}{busy && <div className="assistant-message assistant typing"><span>{en ? 'Preparing the answer...' : 'بجهزلك الرد...'}</span></div>}</div>

          <form className="chat-drawer-input" onSubmit={submit}>
            <input ref={inputRef} name="message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={en ? 'Type your question...' : 'اكتب سؤالك هنا...'} autoComplete="off" aria-label="اكتب سؤالك" disabled={busy} />
            <button type="submit" disabled={busy || !draft.trim()}>{en ? 'Send' : 'إرسال'}</button>
          </form>
          <footer className="chat-drawer-foot"><span>{en ? 'Grades and results require sign in.' : 'الدرجات والنتائج تحتاج تسجيل دخول.'}</span><Link href="/login" onClick={() => setOpen(false)}>{en ? 'Student sign in' : 'دخول الطالب'}</Link></footer>
        </section>
      </div>}
    </>
  );
}
