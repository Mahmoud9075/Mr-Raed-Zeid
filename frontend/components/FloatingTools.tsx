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
  const adminRoute = pathname.startsWith('/admin');
  const quickPrompts = en ? QUICK_PROMPTS_EN : QUICK_PROMPTS_AR;
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [whatsappHref, setWhatsappHref] = useState('https://wa.me/201033246113');
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'assistant', text: en ? 'Hi! I am Mr. Raed Zeid Assistant. Ask me about schedules, fees, booking, English, or the curriculum.' : 'أهلًا! أنا مساعد مستر رائد زيد. اسألني عن المواعيد، الأسعار، الحجز، الإنجليزي أو المنهج.' }]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    if (adminRoute) return;
    api<Record<string,string>>('/site-settings').then((settings) => {
      const raw = (settings.whatsapp || settings.primary_phone || '201033246113').replace(/\D/g, '');
      const number = raw.startsWith('0') ? `20${raw.slice(1)}` : raw;
      setWhatsappHref(`https://wa.me/${number}`);
    }).catch(() => {});
  }, [adminRoute]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }));
  }, [messages, busy, open]);

  useEffect(() => {
    if (adminRoute) return;
    document.body.classList.toggle('chat-is-open', open);
    return () => document.body.classList.remove('chat-is-open');
  }, [open, adminRoute]);

  useEffect(() => {
    if (open && authenticated === true) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, authenticated]);

  function addMessage(role: Message['role'], text: string) {
    const id = nextId.current++;
    setMessages((items) => [...items, { id, role, text }]);
  }

  async function openChat() {
    setOpen(true);
    setAuthenticated(null);
    setBusy(false);
    setDraft('');
    nextId.current = 2;
    setMessages([{ id: 1, role: 'assistant', text: en ? 'Hi! I am Mr. Raed Zeid Assistant. Ask me about schedules, fees, booking, English, or the curriculum.' : 'أهلًا! أنا مساعد مستر رائد زيد. اسألني عن المواعيد، الأسعار، الحجز، الإنجليزي أو المنهج.' }]);
    try {
      await api('/auth/me');
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }

  async function ask(rawText: string) {
    const message = rawText.trim();
    if (!message || busy) return;

    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));
    addMessage('user', message);
    setDraft('');
    setBusy(true);

    try {
      let response: AssistantResponse | null = null;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await api<AssistantResponse>('/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ message, history })
          });
          break;
        } catch (error) {
          lastError = error;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 450));
        }
      }
      if (!response) throw lastError;
      const fallback = en
        ? 'The assistant is unavailable right now. Please try again shortly.'
        : 'المساعد مش متاح دلوقتي، جرّب تاني بعد شوية.';
      addMessage('assistant', response.answer?.trim() || fallback);
    } catch (error) {
      const text = error instanceof Error ? error.message : '';
      if (text.includes('تسجيل الدخول') || text.toLowerCase().includes('sign in')) {
        setAuthenticated(false);
      } else {
        addMessage('assistant', en ? 'The assistant is unavailable right now. Please try again shortly.' : 'المساعد مش متاح دلوقتي، جرّب تاني بعد شوية.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(draft);
  }

  if (adminRoute) return null;

  return (
    <>
      {!open && <div className="floating-tools" aria-label="إجراءات سريعة">
        <a className="floating-action floating-whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M12 2.15a9.72 9.72 0 0 0-8.3 14.78L2.35 21.8l5-1.31A9.76 9.76 0 1 0 12 2.15Zm0 17.7a7.9 7.9 0 0 1-4.02-1.1l-.29-.17-2.97.78.79-2.89-.19-.3A7.86 7.86 0 1 1 12 19.85Z"/>
            <path fill="currentColor" d="M16.55 13.9c-.25-.13-1.5-.74-1.73-.83-.23-.08-.4-.12-.57.13-.17.25-.65.83-.8 1-.15.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.39.11-.51.12-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.38-.78-1.89-.21-.5-.42-.43-.57-.44h-.49c-.17 0-.45.06-.68.32-.23.25-.89.87-.89 2.12 0 1.25.91 2.46 1.04 2.63.13.17 1.79 2.73 4.33 3.83.6.26 1.08.42 1.45.53.61.19 1.16.16 1.6.1.49-.07 1.5-.61 1.71-1.2.21-.59.21-1.1.15-1.2-.06-.11-.23-.17-.48-.3Z"/>
          </svg>
        </a>
        <button className="floating-action floating-chat" type="button" onClick={openChat} aria-label="فتح مساعد مستر رائد زيد" title="اسأل مساعد مستر رائد زيد">
          <span className="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.75h14A2.25 2.25 0 0 1 21.25 7v8A2.25 2.25 0 0 1 19 17.25h-7.05L7.3 20.7a.75.75 0 0 1-1.2-.6v-2.85H5A2.25 2.25 0 0 1 2.75 15V7A2.25 2.25 0 0 1 5 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7.2 10.95h.01M12 10.95h.01M16.8 10.95h.01" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg></span>
          <span className="floating-label">اسأل مساعد مستر رائد زيد</span>
        </button>
      </div>}

      {open && <div className="chat-overlay" role="dialog" aria-modal="true" aria-label={en ? 'Mr. Raed Zeid Assistant' : 'مساعد مستر رائد زيد'}>
        <button className="chat-overlay-backdrop" aria-label={en ? 'Close' : 'إغلاق'} onClick={() => setOpen(false)} />
        <section className="chat-drawer" dir={en ? 'ltr' : 'rtl'}>
          <header className="chat-drawer-head">
            <div className="chat-drawer-title"><span className="chat-head-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.75h14A2.25 2.25 0 0 1 21.25 7v8A2.25 2.25 0 0 1 19 17.25h-7.05L7.3 20.7a.75.75 0 0 1-1.2-.6v-2.85H5A2.25 2.25 0 0 1 2.75 15V7A2.25 2.25 0 0 1 5 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></span><div><span className="chat-drawer-kicker">Mr. Raed Zeid Assistant</span><h2>{en ? 'Ask Mr. Raed Zeid Assistant' : 'مساعد مستر رائد زيد'}</h2><p>{en ? 'Schedules, booking, English and curriculum.' : 'اسأل عن المواعيد، الحجز، الإنجليزي والمنهج.'}</p></div></div>
            <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label={en ? 'Close' : 'إغلاق'}>×</button>
          </header>

          {authenticated === null && <div className="chat-auth-gate" role="status"><span className="typing-indicator" aria-label={en ? 'Checking sign in' : 'جاري التحقق من تسجيل الدخول'}><i/><i/><i/></span><p>{en ? 'Checking your account...' : 'بنتأكد من تسجيل الدخول...'}</p></div>}

          {authenticated === false && <div className="chat-auth-gate">
            <div className="chat-auth-icon" aria-hidden="true">🔒</div>
            <h3>{en ? 'Sign in to use the assistant' : 'سجّل الدخول لاستخدام الشات'}</h3>
            <p>{en ? 'You need a student account before you can chat with Mr. Raed Zeid Assistant.' : 'لازم يكون عندك حساب طالب وتسجّل الدخول الأول علشان تستخدم مساعد مستر رائد زيد.'}</p>
            <div className="chat-auth-actions"><Link className="btn btn-dark" href="/login" onClick={() => setOpen(false)}>{en ? 'Sign in' : 'تسجيل الدخول'}</Link><Link className="btn" href="/register" onClick={() => setOpen(false)}>{en ? 'Create account' : 'إنشاء حساب'}</Link></div>
          </div>}

          {authenticated === true && <>
            <div className="chat-quick-row" aria-label={en ? 'Quick questions' : 'أسئلة سريعة'}>{quickPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={busy}>{prompt}</button>)}</div>

            <div className="chat-drawer-body" ref={bodyRef} aria-live="polite">{messages.map((item) => <div key={item.id} className={`assistant-message ${item.role}`}><span>{item.text}</span></div>)}{busy && <div className="assistant-message assistant typing"><span className="typing-indicator" aria-label={en ? 'Preparing the answer' : 'جاري تجهيز الرد'}><i/><i/><i/></span></div>}</div>

            <form className="chat-drawer-input" onSubmit={submit}>
              <input ref={inputRef} name="message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={en ? 'Type your question...' : 'اكتب سؤالك هنا...'} autoComplete="off" aria-label="اكتب سؤالك" disabled={busy} />
              <button type="submit" disabled={busy || !draft.trim()}>{en ? 'Send' : 'إرسال'}</button>
            </form>
            <footer className="chat-drawer-foot"><span>{en ? 'Your account keeps the assistant and your results connected.' : 'الشات متاح للحسابات المسجلة علشان يقدر يربط إجاباتك بنتائجك.'}</span></footer>
          </>}
        </section>
      </div>}
    </>
  );
}
