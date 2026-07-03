import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const CalendarClient = dynamic(
    () => import('./CalendarClient').then(m => m.CalendarClient),
    { ssr: false }
);

export default async function CalendarPage() {
    const session = await getSessionSafe();
    return <CalendarClient isAdmin={!!session?.user?.sub} />;
}
