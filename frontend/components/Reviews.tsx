'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Lang = 'ar' | 'en';
type Review = { id: number; display_name: string; student_stage: string; rating: number; body: string; status: string };

export default function Reviews({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<Review[]>('/reviews').then(setReviews).catch(() => setReviews([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage('');
    try {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          display_name: form.get('name'),
          student_stage: form.get('stage'),
          rating,
          body: form.get('body')
        })
      });
      event.currentTarget.reset();
      setRating(0);
      setMessage(en ? 'Thanks. Your review was received and will appear after moderation.' : 'تم استلام رأيك وسيظهر بعد المراجعة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'Please try again.' : 'تعذر الإرسال. حاول مرة تانية.'));
    }
  }

  const stageOptions = en
    ? ['Preparatory student', 'General secondary student', 'Azhar secondary student', 'Technical education student', 'Adult course learner', 'Parent', 'Visitor']
    : ['طالب إعدادي', 'طالب ثانوي عام', 'طالب ثانوي أزهري', 'طالب تعليم فني', 'متدرب كورسات للكبار', 'ولي أمر', 'زائر'];

  return (
    <section id="reviews" className="section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container">
        <span className="eyebrow">{en ? 'Student reviews' : 'آراء الطلاب'}</span>
        <h2 className="section-title">{en ? 'Share your experience' : 'شاركنا رأيك'}</h2>
        <p className="section-subtitle">{en ? 'This section starts without fake comments. Only approved real reviews are published.' : 'القسم يبدأ من غير تعليقات جاهزة. التقييمات الحقيقية المعتمدة فقط هي اللي بتظهر بعد المراجعة.'}</p>
        <div className="review-layout">
          <form className="card review-form" onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>{en ? 'Name' : 'الاسم'}</label><input className="input" name="name" required minLength={2} /></div>
              <div className="field"><label>{en ? 'Stage / relation' : 'الصفة / المرحلة'}</label><select className="input" name="stage" required defaultValue=""><option value="" disabled>{en ? 'Choose' : 'اختر صفتك'}</option>{stageOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
            </div>
            <div className="field review-rating"><label>{en ? 'Rating' : 'التقييم'}</label><div className="stars">{[1,2,3,4,5].map((n) => <button type="button" className={`star ${n <= rating ? 'active' : ''}`} onClick={() => setRating(n)} key={n} aria-label={`${n} ${en ? 'stars' : 'نجوم'}`}>★</button>)}</div></div>
            <div className="field review-body"><label>{en ? 'Your review' : 'رأيك'}</label><textarea className="input" name="body" rows={5} required minLength={5} /></div>
            <button className="btn btn-primary review-submit" disabled={!rating}>{en ? 'Send for review' : 'إرسال التقييم للمراجعة'}</button>
            {message && <p className="notice review-message">{message}</p>}
          </form>
          <div>{reviews.length === 0 ? <div className="card review-empty"><h3>{en ? 'No published reviews yet' : 'لا توجد تقييمات منشورة حتى الآن'}</h3><p>{en ? 'The first approved real reviews will appear here.' : 'أول تقييمات حقيقية يتم اعتمادها هتظهر هنا.'}</p></div> : <div className="review-list">{reviews.map((review) => <article className="card review-item" key={review.id}><div className="stars-text">{'★'.repeat(review.rating)}</div><p>{review.body}</p><b>{review.display_name}</b><div>{review.student_stage}</div></article>)}</div>}</div>
        </div>
      </div>
    </section>
  );
}
