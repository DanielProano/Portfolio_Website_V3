import { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { TopBar } from '@shared/components';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { AuthButton } from '@/components/AuthButton';
import './globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

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
        <AppRouterCacheProvider>
          <TopBar authButton={<AuthButton />} />
          {children}
        </AppRouterCacheProvider>
      </body>
      <Analytics />
      <SpeedInsights />
    </html>
  );
}
