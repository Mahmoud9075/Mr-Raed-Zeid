import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'لوحة إدارة مستر رائد',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
