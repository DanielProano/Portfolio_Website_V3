import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const IdeasClient = dynamic(
    () => import('./IdeasClient').then(m => m.IdeasClient),
    { ssr: false }
);

export default async function IdeasPage() {
    const session = await getSessionSafe();
    if (!session) redirect('/auth/login');
    return <IdeasClient isAdmin={session.user.email === process.env.ADMIN_EMAIL} />;
}
