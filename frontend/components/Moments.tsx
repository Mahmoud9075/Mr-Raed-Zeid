type Lang = 'ar' | 'en';
const videos = [1, 2, 3];
const photos = [1, 2, 3, 4, 5, 6];

export default function Moments({ lang = 'ar' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <section id="moments" className="section navy-section" dir={en ? 'ltr' : 'rtl'}>
      <div className="container">
        <span className="eyebrow">{en ? 'From the center' : 'من قلب السنتر'}</span>
        <h2 className="section-title">{en ? 'Real moments from lessons and student life' : 'لحظات حقيقية من أجواء الشرح والطلاب'}</h2>
        <p className="section-subtitle moments-subtitle">{en ? 'Videos and photos from real classes and activities.' : 'فيديوهات ولقطات حقيقية من السنتر وذكريات مع الطلاب.'}</p>
        <div className="video-grid">
          {videos.map((i) => (
            <figure className="video-card" key={i}>
              <video controls playsInline preload="metadata" poster={`/media/video-${String(i).padStart(2, '0')}-poster.jpg`}>
                <source src={`/media/video-${String(i).padStart(2, '0')}.mp4`} type="video/mp4" />
              </video>
              <figcaption>{en ? 'A moment from the center' : 'لقطة من أجواء السنتر'}</figcaption>
            </figure>
          ))}
        </div>
        <div className="photo-grid">{photos.map((i) => <img loading="lazy" key={i} src={`/media/students-${String(i).padStart(2, '0')}.jpg`} alt={en ? 'Student moments' : 'لحظات مع طلابنا'} />)}</div>
      </div>
    </section>
  );
}
