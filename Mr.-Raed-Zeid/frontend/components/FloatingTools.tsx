'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Message = { role: 'user' | 'assistant'; text: string };

const QUICK_PROMPTS = [
  'مواعيد السنتر إيه؟',
  'الاشتراك بكام؟',
  'فين مكان السنتر؟',
  'اشرحلي قاعدة في الجرامر',
  'إيه معنى الكلمة دي؟'
];

export default function FloatingTools() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'أهلًا! أنا مساعد مستر رائد. اسألني عن المواعيد، الأسعار، الحجز، الإنجليزي أو المنهج.' }
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((items) => [...items, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const response = await api<{ answer: string }>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      setMessages((items) => [...items, { role: 'assistant', text: response.answer }]);
    } catch {
      setMessages((items) => [
        ...items,
        {
          role: 'assistant',
          text: 'السؤال ده محتاج مستر رائد بشكل مباشر. تقدر تتواصل معاه من زر واتساب.'
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') || '');
    event.currentTarget.reset();
    await ask(message);
  }

  return (
    <>
      <div className="floating-tools" aria-label="Quick actions">
        <a
          className="floating-action floating-whatsapp"
          href="https://wa.me/201033246113"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل مع مستر رائد على واتساب"
          title="واتساب"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.01 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.93 9.93 0 0 0 12.01 22C17.53 22 22 17.52 22 12S17.53 2 12.01 2Zm0 18.06c-1.63 0-3.15-.46-4.45-1.25l-.32-.19-3.01.79.8-2.93-.21-.3A8.02 8.02 0 0 1 4 12c0-4.42 3.59-8 8.01-8 4.41 0 8 3.58 8 8s-3.59 8.06-8 8.06Zm4.4-5.99c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.55.12-.16.24-.63.78-.77.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.21-.72-.64-1.21-1.43-1.35-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z" /></svg>
        </a>
        <button
          className="floating-action floating-chat"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="اسأل مساعد مستر رائد"
          title="اسأل مساعد مستر رائد"
        >
          <span className="chat-spark">✦</span>
          <span className="floating-label">اسأل مساعد مستر رائد</span>
        </button>
      </div>

      {open && (
        <div className="chat-overlay" role="dialog" aria-modal="true" aria-label="مساعد مستر رائد">
          <button className="chat-overlay-backdrop" aria-label="إغلاق" onClick={() => setOpen(false)} />
          <section className="chat-drawer">
            <header className="chat-drawer-head">
              <div>
                <span className="chat-drawer-kicker">Mr. Raed Assistant</span>
                <h2>اسأل مساعد مستر رائد</h2>
                <p>مواعيد، أسعار، حجز، إنجليزي ومنهج.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
            </header>

            <div className="chat-quick-row">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={busy}>{prompt}</button>
              ))}
            </div>

            <div className="chat-drawer-body" ref={bodyRef}>
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`assistant-message ${message.role}`}>
                  <span>{message.text}</span>
                </div>
              ))}
              {busy && <div className="assistant-message assistant"><span>بجهزلك الرد...</span></div>}
            </div>

            <form className="chat-drawer-input" onSubmit={submit}>
              <input name="message" placeholder="اكتب سؤالك هنا..." autoComplete="off" aria-label="اكتب سؤالك" />
              <button type="submit" disabled={busy}>إرسال</button>
            </form>
            <footer className="chat-drawer-foot">
              <span>الدرجات والنتائج تحتاج تسجيل دخول.</span>
              <Link href="/login" onClick={() => setOpen(false)}>دخول الطالب</Link>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
