import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const FlashcardsClient = dynamic(
    () => import('./FlashcardsClient').then(m => m.FlashcardsClient),
    { ssr: false }
);

export default async function FlashcardsPage() {
    const session = await getSessionSafe();
    // Signed-out visitors never reach the client. Everyone who does gets their own
    // isolated data — every query is scoped to their Auth0 sub — so editing is always on.
    if (!session) redirect('/auth/login');
    return <FlashcardsClient canEdit />;
}
