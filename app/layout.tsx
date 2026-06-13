import './globals.css';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';

import { SiteBadges } from '@/components/site-badges';
import { SiteHeader } from '@/components/site-header';
import { messages } from '@/lib/messages';

const thmanyahSans = localFont({
  src: [
    {
      path: '../assets/font/thmanyahsans/thmanyahsans-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/font/thmanyahsans/thmanyahsans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/font/thmanyahsans/thmanyahsans-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/font/thmanyahsans/thmanyahsans-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../assets/font/thmanyahsans/thmanyahsans-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-thmanyah-sans',
  display: 'swap',
});

export const metadata = {
  title: messages.meta.title,
  description: messages.meta.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html dir="rtl" lang="ar">
      <body className={`${thmanyahSans.variable} min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] antialiased [font-family:var(--font-thmanyah-sans),ui-sans-serif,system-ui,sans-serif]`}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#4a412c_0,rgba(74,65,44,0.18)_12%,transparent_38%),radial-gradient(circle_at_20%_20%,rgba(201,168,106,0.12),transparent_24%),radial-gradient(circle_at_80%_12%,rgba(137,101,54,0.14),transparent_20%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:72px_72px] opacity-20" />
          <div className="pointer-events-none absolute inset-0 noise-overlay opacity-40" />
          <SiteHeader />
          <main className="relative mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">{children}</main>
          <SiteBadges />
        </div>
      </body>
    </html>
  );
}
