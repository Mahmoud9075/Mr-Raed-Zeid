import type { Metadata } from 'next';
import './globals.css';
import SiteGate from '@/components/SiteGate';
import FloatingTools from '@/components/FloatingTools';
import MotionOrchestrator from '@/components/MotionOrchestrator';
import RouteTracker from '@/components/RouteTracker';

export const metadata: Metadata = {
  title: 'Mr. Raed Zeid | English Teacher',
  description: 'منصة مستر رائد زيد لتعليم اللغة الإنجليزية، الاختبارات، المتابعة والمحتوى التعليمي.',
  openGraph: {
    title: 'Mr. Raed Zeid | English Teacher',
    description: 'شرح واضح، تدريب عملي، واختبارات ومتابعة للطلاب.',
    type: 'website'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <SiteGate>{children}</SiteGate>
        <MotionOrchestrator />
        <RouteTracker />
        <FloatingTools />
      </body>
    </html>
  );
}
