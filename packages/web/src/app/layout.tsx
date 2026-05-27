import { ReactNode } from 'react';
import { TopBar } from '@shared/components';
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
        <TopBar />
        {children}
      </body>
    </html>
  );
}