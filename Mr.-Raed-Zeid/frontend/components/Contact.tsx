'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

type Lang = 'ar' | 'en';

export default function Contact({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/contact', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), phone: form.get('phone'), message: form.get('message') })
      });
      event.currentTarget.reset();
      setMessage(en ? 'Your message was received.' : 'تم استلام رسالتك.');
    } catch {
      setMessage(en ? 'Please try again in a moment, or use WhatsApp.' : 'جرب تبعت الرسالة مرة تانية بعد لحظات، أو تواصل على واتساب.');
    }
  }

  return (
    <section id="contact" className="section soft-section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container contact-grid">
        <div className="card contact-main">
          <span className="eyebrow">{en ? 'Contact & booking' : 'التواصل والحجز'}</span>
          <h2 className="section-title">{en ? 'Book or ask about your group' : 'احجز أو اسأل عن مجموعتك'}</h2>
          <p className="section-subtitle">{en ? 'For schedules, booking and group details, contact us directly or send a message here.' : 'للحجز والمواعيد وتفاصيل المجموعات، تواصل مباشرة أو ابعت استفسارك من هنا.'}</p>
          <div className="contact-data">
            <b>{en ? 'Main WhatsApp: 01033246113' : 'الواتساب الأساسي: 01033246113'}</b>
            <span>{en ? 'Additional number: 01278833689' : 'رقم إضافي: 01278833689'}</span>
            <span>{en ? 'Every day · 8:00 AM to 8:00 PM' : 'كل أيام الأسبوع · من 8 صباحًا إلى 8 مساءً'}</span>
            <span>{en ? 'Ebdaa Center · Street 20 · building facing the electrical transformer · second upper floor' : 'سنتر إبداع · شارع 20 · العمارة المواجهة لمحول الكهرباء · الدور الثاني علوي'}</span>
          </div>
          <a className="btn btn-dark contact-whatsapp" href="https://wa.me/201033246113" target="_blank" rel="noopener noreferrer">{en ? 'Open WhatsApp' : 'ابدأ محادثة واتساب'}</a>
        </div>

        <form className="card contact-links" onSubmit={submit}>
          <h3>{en ? 'Send your question' : 'أرسل استفسارك'}</h3>
          <div className="field"><label>{en ? 'Name' : 'الاسم'}</label><input name="name" className="input" required /></div>
          <div className="field contact-field"><label>{en ? 'Phone' : 'رقم الهاتف'}</label><input name="phone" className="input" required inputMode="tel" /></div>
          <div className="field contact-field"><label>{en ? 'Message' : 'الرسالة'}</label><textarea name="message" className="input" rows={4} required /></div>
          <button className="btn btn-primary contact-submit">{en ? 'Send' : 'إرسال'}</button>
          {message && <p className="notice">{message}</p>}
          <div className="link-row"><a href="mailto:Raedzeid15@gmail.com">{en ? 'Email' : 'البريد الإلكتروني'}</a><span>↗</span></div>
          <div className="link-row"><a href="https://youtube.com/@rempire929" target="_blank" rel="noopener noreferrer">YouTube</a><span>↗</span></div>
        </form>
      </div>
    </section>
  );
}
