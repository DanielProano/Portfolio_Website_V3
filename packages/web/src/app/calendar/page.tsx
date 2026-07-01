import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const CalendarClient = dynamic(
    () => import('./CalendarClient').then(m => m.CalendarClient),
    { ssr: false }
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function CalendarPage() {
    const session = await getSessionSafe();
    const isAdmin = session?.user?.email === ADMIN_EMAIL;

    return <CalendarClient isAdmin={isAdmin} />;
}
