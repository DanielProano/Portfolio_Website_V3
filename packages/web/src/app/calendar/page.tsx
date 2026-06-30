import { auth0 } from '@/lib/auth0';
import { CalendarClient } from './CalendarClient';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function CalendarPage() {
    const session = await auth0.getSession();
    const isAdmin = session?.user?.email === ADMIN_EMAIL;

    return <CalendarClient isAdmin={isAdmin} />;
}
