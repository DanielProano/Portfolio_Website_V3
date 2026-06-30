import { ReactNode } from 'react';
import { TopBar } from '@shared/components';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Providers } from '@/components/Providers';
import { AuthButton } from '@/components/AuthButton';
import './globals.css';

export const metadata = {
  title: 'Daniel Proano | Embedded Security Engineer',
  description: 'An embedded security engineer at Purdue University at the intersection of autonomous systems, embedded development, and robotics hardware',
  openGraph: {
    title: 'Daniel Proano | Embedded Security Engineer',
    description: 'An embedded security engineer at Purdue University at the intersection of autonomous systems, embedded development, and robotics hardware',
    images: [{ url: '/profile/self_autonomous.jpg' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopBar authButton={<AuthButton />} />
          {children}
        </Providers>
      </body>
      <Analytics />
      <SpeedInsights />
    </html>
  );
}