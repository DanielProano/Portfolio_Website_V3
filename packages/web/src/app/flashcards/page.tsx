import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const FlashcardsClient = dynamic(
    () => import('./FlashcardsClient').then(m => m.FlashcardsClient),
    { ssr: false }
);

export default async function FlashcardsPage() {
    const session = await getSessionSafe();
    return <FlashcardsClient isAdmin={session?.user?.email === process.env.ADMIN_EMAIL} />;
}
