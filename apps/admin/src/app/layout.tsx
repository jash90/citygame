import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/shared/providers/query-provider';
import { ServiceWorkerRegister } from '@/shared/components/ServiceWorkerRegister';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CityGame Admin',
  description: 'Panel administracyjny CityGame',
  applicationName: 'CityGame Admin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CityGame',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
