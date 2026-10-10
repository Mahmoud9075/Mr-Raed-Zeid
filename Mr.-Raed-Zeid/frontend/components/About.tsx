export default function About(){
 const stages=['إعدادي','ثانوي عام','ثانوي أزهري','ثانوي فني','تجاري وزراعي','كورسات للكبار'];
 return <section id="about" className="section"><div className="container about-grid">
   <div className="about-copy"><span className="eyebrow">نبذة عن المستر</span><h2 className="section-title">مستر رائد زيد</h2>
   <p>مدرس لغة إنجليزية، خريج كلية الآداب – جامعة دمنهور، قسم اللغة الإنجليزية – شعبة لغات وترجمة. باحث ماجستير في اللغة الإنجليزية، وحاصل على دبلومة تربوية، ويعمل في التدريس والترجمة منذ أكثر من 8 سنوات. يعتمد في شرحه على السبورة التفاعلية، التطبيق العملي، الحل من الكتاب والواجبات والمتابعة المستمرة.</p>
   <div className="stage-list">{stages.map(s=><span key={s}>{s}</span>)}</div>
   <div className="fact-list"><div className="fact"><b>الدراسة</b><span>كلية الآداب – جامعة دمنهور · قسم اللغة الإنجليزية – شعبة لغات وترجمة</span></div><div className="fact"><b>التأهيل</b><span>باحث ماجستير في اللغة الإنجليزية · دبلومة تربوية · ICDL TEACHER</span></div><div className="fact"><b>النظام</b><span>شرح تفاعلي · واجبات وتصحيح · اختبارات بعد كل وحدة · مراجعات حتى ليلة الامتحان</span></div></div></div>
   <figure className="about-photo"><img src="/media/about-raed.png" alt="مستر رائد زيد في مكتبه" /></figure>
 </div></section>
}
