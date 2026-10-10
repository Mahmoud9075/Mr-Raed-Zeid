import Link from 'next/link';
export default function Hero(){
 return <section className="hero"><div className="container"><div className="hero-card">
   <div className="hero-copy">
    <h1 className="hero-name">Mr. Raed <span>Zeid.</span></h1>
    <h2 className="hero-tagline">افهم الإنجليزي. اتكلم بثقة.</h2>
    <p className="hero-desc">مستر رائد زيد، مدرس لغة إنجليزية بخبرة أكثر من 8 سنوات. شرح واضح، تدريب عملي، ومتابعة مستمرة لمختلف المراحل.</p>
    <div className="hero-badges"><span className="pill">8+ سنوات خبرة</span><span className="pill">كل المراحل</span><span className="pill">متابعة مستمرة</span></div>
    <div className="hero-actions"><Link className="btn btn-primary" href="#moments">شوف أجواء السنتر ←</Link><Link className="btn" href="#about">اعرف المستر ↓</Link></div>
   </div>
   <div className="hero-visual"><div className="portrait-frame"><img src="/media/hero-raed.jpg" alt="مستر رائد زيد" /></div><div className="portrait-label">مدرس اللغة الإنجليزية · أبو حمص</div></div>
 </div></div></section>
}
