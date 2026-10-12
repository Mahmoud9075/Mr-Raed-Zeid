import Link from "next/link";

type HeroProps = {
  lang?: "ar" | "en";
};

export default function Hero({ lang = "ar" }: HeroProps) {
  const isEnglish = lang === "en";

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-card">
          <div className="hero-copy">
            <h1 className="hero-name">
              Mr. Raed <span>Zeid.</span>
            </h1>

            <h2 className="hero-tagline">
              {isEnglish
                ? "Understand English. Speak with confidence."
                : "افهم الإنجليزي. اتكلم بثقة."}
            </h2>

            <p className="hero-desc">
              {isEnglish
                ? "Mr. Raed Zeid is an English teacher with more than 8 years of experience. Clear explanations, practical training, and continuous follow-up for different educational stages."
                : "مستر رائد زيد، مدرس لغة إنجليزية بخبرة أكثر من 8 سنوات. شرح واضح، تدريب عملي، ومتابعة مستمرة لمختلف المراحل."}
            </p>

            <div className="hero-badges">
              <span className="pill">
                {isEnglish ? "8+ Years Experience" : "8+ سنوات خبرة"}
              </span>

              <span className="pill">
                {isEnglish ? "Different Stages" : "مراحل مختلفة"}
              </span>

              <span className="pill">
                {isEnglish ? "Continuous Follow-up" : "متابعة مستمرة"}
              </span>
            </div>

            <div className="hero-actions">
              <Link className="btn btn-primary" href="#moments">
                {isEnglish ? "See Center Moments →" : "شوف أجواء السنتر ←"}
              </Link>

              <Link className="btn" href="#about">
                {isEnglish ? "About Mr. Raed ↓" : "اعرف المستر ↓"}
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="portrait-frame">
              <img
                src="/media/hero-raed.jpg"
                alt={isEnglish ? "Mr. Raed Zeid" : "مستر رائد زيد"}
              />
            </div>

            <div className="portrait-label">
              {isEnglish
                ? "English Teacher · Abu Hummus"
                : "مدرس اللغة الإنجليزية · أبو حمص"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
