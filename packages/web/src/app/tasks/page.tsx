import dynamic from 'next/dynamic';
import { getSessionSafe } from '@/lib/auth0';

const TasksClient = dynamic(
    () => import('./TasksClient').then(m => m.TasksClient),
    { ssr: false }
);

export default async function TasksPage() {
    const session = await getSessionSafe();
    return <TasksClient isAdmin={session?.user?.email === process.env.ADMIN_EMAIL} />;
}
