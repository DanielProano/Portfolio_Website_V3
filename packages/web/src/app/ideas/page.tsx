import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const IdeasClient = dynamic(
    () => import('./IdeasClient').then(m => m.IdeasClient),
    { ssr: false }
);

export default async function IdeasPage() {
    const session = await getSessionSafe();
    return <IdeasClient isAdmin={!!session?.user?.sub} />;
}
