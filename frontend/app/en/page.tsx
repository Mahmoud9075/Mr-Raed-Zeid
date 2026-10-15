import Header from '@/components/Header';
import Hero from '@/components/Hero';
import About from '@/components/About';
import QuizPromo from '@/components/QuizPromo';
import Moments from '@/components/Moments';
import Achievements from '@/components/Achievements';
import Reviews from '@/components/Reviews';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';

type Nav = { slug: string };

export default async function EnglishHome() {
  let nav: Nav[] = [];
  try { nav = await api<Nav[]>('/navigation'); } catch {}
  const visible = (slug: string) => !nav.length || nav.some((item) => item.slug === slug);

  return (
    <div className="english-page" dir="ltr" lang="en">
      <Header lang="en" />
      <main>
        <Hero lang="en" />
        {visible('about') && <About lang="en" />}
        {visible('quizzes') && <QuizPromo lang="en" />}
        {visible('moments') && <Moments lang="en" />}
        {(visible('students') || visible('honors')) && <Achievements lang="en" showStudents={visible('students')} showHonors={visible('honors')} />}
        {visible('reviews') && <Reviews lang="en" />}
        {visible('contact') && <Contact lang="en" />}
      </main>
      <Footer lang="en" />
    </div>
  );
}
