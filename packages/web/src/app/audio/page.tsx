import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const AudioClient = dynamic(
    () => import('./AudioClient').then(m => m.AudioClient),
    { ssr: false }
);

export const metadata = {
    title: 'Audio',
    robots: { index: false, follow: false },
};

export default async function AudioPage() {
    const session = await getSessionSafe();
    if (!session) redirect('/auth/login');
    // Admin-only: signed-in non-admins are bounced, not shown an empty library.
    if (!process.env.ADMIN_EMAIL || session.user.email !== process.env.ADMIN_EMAIL) redirect('/');
    return <AudioClient />;
}
