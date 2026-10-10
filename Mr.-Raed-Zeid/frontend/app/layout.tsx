import type { Metadata } from 'next';
import './globals.css';
import SiteGate from '@/components/SiteGate';

export const metadata: Metadata = {
  title: 'Mr. Raed Zeid | English Teacher',
  description: 'منصة مستر رائد زيد لتعليم اللغة الإنجليزية، الاختبارات، المتابعة والمحتوى التعليمي.',
  openGraph: {title:'Mr. Raed Zeid | English Teacher',description:'شرح واضح، تدريب عملي، واختبارات ومتابعة للطلاب.',type:'website'}
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><SiteGate>{children}</SiteGate></body></html>;
}
