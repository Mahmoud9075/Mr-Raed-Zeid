'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Lang = 'ar' | 'en';

type Settings = Record<string, string>;
const DEFAULTS: Settings = {
  primary_phone: '01033246113',
  secondary_phone: '01278833689',
  whatsapp: '201033246113',
  contact_email: 'Raedzeid15@gmail.com',
  center_hours: 'كل أيام الأسبوع من 8 صباحًا إلى 8 مساءً',
  center_address: 'سنتر إبداع، شارع 20، العمارة المواجهة لمحول الكهرباء، الدور الثاني علوي',
  youtube: 'https://youtube.com/@rempire929'
};

export default function Contact({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    api<Settings>('/site-settings').then((value) => setSettings({ ...DEFAULTS, ...value })).catch(() => {});
  }, []);

  const whatsappHref = useMemo(() => {
    const digits = (settings.whatsapp || settings.primary_phone || '').replace(/\D/g, '');
    const normalized = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
    return `https://wa.me/${normalized}`;
  }, [settings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/contact', { method: 'POST', body: JSON.stringify({ name: form.get('name'), phone: form.get('phone'), message: form.get('message') }) });
      event.currentTarget.reset();
      setMessage(en ? 'Your message was received.' : 'تم استلام رسالتك.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'Please try again or use WhatsApp.' : 'جرب تبعت الرسالة مرة تانية، أو تواصل على واتساب.'));
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
            <b>{en ? `Main WhatsApp: ${settings.primary_phone}` : `الواتساب الأساسي: ${settings.primary_phone}`}</b>
            <span>{en ? `Additional number: ${settings.secondary_phone}` : `رقم إضافي: ${settings.secondary_phone}`}</span>
            <span>{settings.center_hours}</span>
            <span>{settings.center_address}</span>
          </div>
          <a className="btn btn-dark contact-whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer">{en ? 'Open WhatsApp' : 'ابدأ محادثة واتساب'}</a>
        </div>

        <form className="card contact-links" onSubmit={submit}>
          <h3>{en ? 'Send your question' : 'أرسل استفسارك'}</h3>
          <div className="field"><label>{en ? 'Name' : 'الاسم'}</label><input name="name" className="input" required /></div>
          <div className="field contact-field"><label>{en ? 'Phone' : 'رقم الهاتف'}</label><input name="phone" className="input" required inputMode="tel" /></div>
          <div className="field contact-field"><label>{en ? 'Message' : 'الرسالة'}</label><textarea name="message" className="input" rows={4} required /></div>
          <button className="btn btn-primary contact-submit">{en ? 'Send' : 'إرسال'}</button>
          {message && <p className="notice">{message}</p>}
          <div className="link-row"><a href={`mailto:${settings.contact_email}`}>{en ? 'Email' : 'البريد الإلكتروني'}</a><span>↗</span></div>
          <div className="link-row"><a href={settings.youtube} target="_blank" rel="noopener noreferrer">YouTube</a><span>↗</span></div>
        </form>
      </div>
    </section>
  );
}
