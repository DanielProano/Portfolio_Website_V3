import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const TasksClient = dynamic(
    () => import('./TasksClient').then(m => m.TasksClient),
    { ssr: false }
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function TasksPage() {
    const session = await getSessionSafe();
    const isAdmin = session?.user?.email === ADMIN_EMAIL;
    return <TasksClient isAdmin={isAdmin} />;
}
