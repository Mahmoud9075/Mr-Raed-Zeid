const videos=[1,2,3]; const photos=[1,2,3,4,5,6];
export default function Moments(){return <section id="moments" className="section navy-section"><div className="container"><span className="eyebrow">من قلب السنتر</span><h2 className="section-title">لحظات حقيقية من أجواء الشرح والطلاب</h2><p className="section-subtitle" style={{color:'#d8e3eb'}}>فيديوهات ولقطات من السنتر وذكريات مع الطلاب.</p>
<div className="video-grid">{videos.map(i=><figure className="video-card" key={i}><video controls playsInline poster={`/media/video-${String(i).padStart(2,'0')}-poster.jpg`}><source src={`/media/video-${String(i).padStart(2,'0')}.mp4`} type="video/mp4"/></video><figcaption>لقطة من أجواء السنتر</figcaption></figure>)}</div>
<div className="photo-grid">{photos.map(i=><img key={i} src={`/media/students-${String(i).padStart(2,'0')}.jpg`} alt="لحظات مع طلابنا" />)}</div>
</div></section>}
