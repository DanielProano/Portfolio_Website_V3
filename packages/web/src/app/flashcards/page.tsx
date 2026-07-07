import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const FlashcardsClient = dynamic(
    () => import('./FlashcardsClient').then(m => m.FlashcardsClient),
    { ssr: false }
);

export default async function FlashcardsPage() {
    const session = await getSessionSafe();
    if (!session) redirect('/auth/login');
    return <FlashcardsClient isAdmin={session.user.email === process.env.ADMIN_EMAIL} />;
}
