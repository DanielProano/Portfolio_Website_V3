import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const CalendarClient = dynamic(
    () => import('./CalendarClient').then(m => m.CalendarClient),
    { ssr: false }
);

export default async function CalendarPage() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        redirect('/');
    }

    return <CalendarClient isAdmin={true} />;
}
